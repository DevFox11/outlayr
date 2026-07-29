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

    /// Where this extension leaves work for the app to commit.
    static let pendingWritesKey = "pendingWrites"

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

    /// Appends rather than replaces: several intents can run while the app is
    /// closed, and each one is a separate entry.
    static func enqueue(_ write: PendingWrite) {
        guard let store else { return }
        var queue = pendingWrites()
        queue.append(write)
        if let data = try? JSONEncoder().encode(queue),
           let json = String(data: data, encoding: .utf8) {
            store.set(json, forKey: pendingWritesKey)
        }
    }

    static func pendingWrites() -> [PendingWrite] {
        guard let raw = store?.string(forKey: pendingWritesKey),
              let data = raw.data(using: .utf8),
              let queue = try? JSONDecoder().decode([PendingWrite].self, from: data) else {
            return []
        }
        return queue
    }
}

extension String {
    /// Empty strings are how an unset optional text parameter arrives; the wire
    /// format wants a real nil so the app can tell "not given" from "given blank".
    var nilIfEmpty: String? { isEmpty ? nil : self }
}

/// Mirrors `PendingWrite` in `src/lib/widget-bridge.ts`; the field names are the
/// wire format and cannot be renamed on one side alone.
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
    /// An explicit ISO code, when the automation pins one. Beats `amountText`.
    let currency: String?
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
