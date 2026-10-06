import AppIntents
import Foundation

/// iOS 27's Notification trigger hands over title, subtitle and body as free
/// text from any app, so the amount and merchant are read out app-side — see
/// `parseNotification` in `src/domain/parse-notification.ts`. A notification
/// that names no amount is dropped there, silently: the trigger fires on every
/// notification the app sends, not only purchases.
struct LogNotificationIntent: AppIntent {
    static var title: LocalizedStringResource = "Log from a Notification"

    static var description = IntentDescription(
        """
        Reads a purchase out of a bank or Wallet notification and adds it to \
        your ledger. Built for a Notification automation: pass the Title, \
        Subtitle and Body straight through.
        """
    )

    static var openAppWhenRun: Bool = false

    @Parameter(title: "Title")
    var notificationTitle: String?

    @Parameter(title: "Subtitle")
    var subtitle: String?

    @Parameter(title: "Body")
    var body: String?

    @Parameter(title: "Account")
    var card: String?

    @Parameter(title: "Type", default: .expense)
    var side: LedgerSide

    static var parameterSummary: some ParameterSummary {
        Summary("Log \(\.$body) as \(\.$side)") {
            \.$notificationTitle
            \.$subtitle
            \.$card
        }
    }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let text = [notificationTitle, subtitle, body]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty }
            .joined(separator: "\n")
        guard !text.isEmpty else {
            throw $body.needsValueError("What did the notification say?")
        }

        let purchase = Self.dedupeKey(text: text, side: side)
        SharedStore.enqueue(
            PendingWrite(
                id: UUID().uuidString,
                amount: 0,
                income: side == .income,
                note: "",
                category: nil,
                date: Date().timeIntervalSince1970 * 1000,
                amountText: nil,
                card: card?
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                    .nilIfEmpty,
                currency: nil,
                dedupeKey: purchase,
                text: text
            )
        )

        let source = notificationTitle?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty ?? "a notification"
        await SharedStore.notify(
            "Noted a purchase from \(source). Open Outlayr to review it.",
            purchase: purchase
        )
        return .result(dialog: IntentDialog("Noted."))
    }

    /// The same push delivered twice is the same purchase; whitespace is the
    /// only thing Shortcuts is seen to vary between deliveries.
    static func dedupeKey(text: String, side: LedgerSide) -> String {
        let collapsed = text
            .lowercased()
            .split(whereSeparator: \.isWhitespace)
            .joined(separator: " ")
        return "notification:\(side.rawValue):\(collapsed)"
    }
}
