import Foundation

/// The App Group both the app and this extension can reach.
///
/// Kept in sync with `APP_GROUP` in `app.config.ts` by the target config, which
/// mirrors `ios.entitlements` into this target's generated entitlements. If the
/// two ever disagree the container resolves to nil, which is why `store` is
/// failable rather than force-unwrapped.
enum SharedStore {
    static let appGroup = "group.com.tryoutlayr.app"

    /// Where the app leaves the figures the read-only intents report.
    static let snapshotKey = "intentSnapshot"

    /// Where this extension leaves work for the app to commit, one JSON line per
    /// write. Mirrored by `QUEUE_DIRECTORY` / `QUEUE_FILE` in
    /// `src/lib/pending-writes-core.ts`.
    static let queueDirectory = "pending-writes"
    static let queueFile = "queue.jsonl"

    static var store: UserDefaults? {
        UserDefaults(suiteName: appGroup)
    }

    /// The app writes this on every data change and on backgrounding, so nil
    /// means the app has not run since install rather than that the data is late.
    static func snapshot() -> IntentSnapshot? {
        guard let raw = store?.string(forKey: snapshotKey),
              let data = raw.data(using: .utf8) else {
            return nil
        }
        return try? JSONDecoder().decode(IntentSnapshot.self, from: data)
    }

    /// Appends one line to a file rather than rewriting a queue held in a single
    /// `UserDefaults` string. Several intents can run while the app is closed,
    /// and read-append-write let two of them overwrite each other; an `O_APPEND`
    /// write reserves its own offset in the kernel, so nothing is read first and
    /// there is nothing to lose. The app never edits this file in place either —
    /// it renames it aside to drain it.
    static func enqueue(_ write: PendingWrite) {
        guard let url = queueURL(),
              var line = try? JSONEncoder().encode(write) else { return }
        line.append(0x0A)
        append(line, to: url)
    }

    private static func queueURL() -> URL? {
        guard let container = FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: appGroup) else {
            return nil
        }
        let directory = container.appendingPathComponent(
            queueDirectory, isDirectory: true
        )
        // Pinned rather than left to the platform default: a Wallet automation
        // runs while the phone is locked, so the class has to be one that
        // survives the lock. It goes on the directory because a new file takes
        // the class of the directory it is created in, and the file below is
        // created by `open`, which cannot carry attributes.
        try? FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true,
            attributes: [
                .protectionKey: FileProtectionType.completeUntilFirstUserAuthentication
            ]
        )
        return directory.appendingPathComponent(queueFile, isDirectory: false)
    }

    private static func append(_ bytes: Data, to url: URL) {
        let descriptor = open(url.path, O_WRONLY | O_APPEND | O_CREAT, 0o644)
        guard descriptor >= 0 else { return }
        defer { close(descriptor) }
        bytes.withUnsafeBytes { buffer in
            guard let base = buffer.baseAddress else { return }
            var written = 0
            while written < buffer.count {
                let count = Darwin.write(descriptor, base + written, buffer.count - written)
                guard count > 0 else { return }
                written += count
            }
        }
    }
}

extension String {
    /// Empty strings are how an unset optional text parameter arrives; the wire
    /// format wants a real nil so the app can tell "not given" from "given blank".
    var nilIfEmpty: String? { isEmpty ? nil : self }
}

/// Mirrors `PendingWrite` in `src/lib/pending-writes-core.ts`; the field names
/// are the wire format and cannot be renamed on one side alone.
struct PendingWrite: Codable {
    let id: String
    let amount: Double
    let income: Bool
    let note: String
    let category: String?
    /// Epoch milliseconds, matching JavaScript's `Date` — not seconds.
    let date: Double
    /// The amount exactly as it arrived, e.g. "€12,40", so the app can recover
    /// which currency it was in: a Wallet transaction is in the *card's*
    /// currency, not the ledger's. Resolved app-side, where the catalog lives.
    let amountText: String?
    /// The Wallet card the purchase was made with, by its name in Wallet. The
    /// app matches it to one of its accounts; nil for a spoken entry.
    let card: String?
    /// An explicit ISO code, when the automation pins one. Beats `amountText`.
    let currency: String?
    /// Identifies the purchase, where `id` identifies this enqueue. Nil for a
    /// spoken entry, which names no purchase outside itself.
    let dedupeKey: String?
}

/// A projection of `WidgetProps` in `src/widgets/props.ts`: every figure arrives
/// already formatted in the user's currency and cents preference, so an intent
/// never has to reason about money.
struct IntentSnapshot: Codable {
    struct Budget: Codable {
        let present: Bool
        let name: String
        let periodLabel: String
        let remaining: String
        let remainingCaption: String
        let spent: String
        let limit: String
        let percent: String
    }

    struct Insights: Codable {
        let periodLabel: String
        let rangeLabel: String
        let net: String
        let netPositive: Bool
        let spent: String
        let income: String
    }

    /// Every budget is published because a spoken name arrives as a string that
    /// has to be matched against the real set — see `BudgetQuery`.
    struct NamedBudget: Codable {
        let id: String
        let name: String
        let remaining: String
        let remainingCaption: String
        let spent: String
        let limit: String
        let percent: String
        let periodLabel: String
    }

    let budget: Budget
    let insights: Insights
    /// Ordered overall first, which is the fallback when no budget is named.
    ///
    /// Optional so a snapshot written by an older build still decodes: the
    /// extension can ship ahead of the app, and one missing key would fail the
    /// whole `IntentSnapshot` decode.
    let budgets: [NamedBudget]?
}
