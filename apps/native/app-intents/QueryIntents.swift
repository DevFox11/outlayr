import AppIntents
import SwiftUI

/// `budget` is optional rather than required: a required parameter makes Siri
/// stop and ask "which budget?" instead of reporting the overall one.
struct BudgetLeftoverIntent: AppIntent {
    static var title: LocalizedStringResource = "Check Budget"

    static var description = IntentDescription(
        "Reports how much is left in a budget for the current period."
    )

    static var openAppWhenRun: Bool = false

    @Parameter(title: "Budget")
    var budget: BudgetEntity?

    static var parameterSummary: some ParameterSummary {
        Summary("Check \(\.$budget)")
    }

    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView & ReturnsValue<String> {
        guard let snapshot = SharedStore.snapshot() else {
            return .result(
                value: "",
                dialog: IntentDialog("Open Outlayr once and I can report on it."),
                view: MessageSnippet(text: "No data yet")
            )
        }

        let namedBudgets = snapshot.budgets ?? []
        // A named budget when one was given, else the first published — which the
        // app orders overall-first.
        let chosen =
            budget.flatMap { named in
                namedBudgets.first { $0.id == named.id }
            } ?? (budget == nil ? namedBudgets.first : nil)

        guard let found = chosen else {
            return .result(
                value: "",
                dialog: IntentDialog(
                    budget == nil
                        ? "You have not set a budget in Outlayr yet."
                        : "I could not find that budget in Outlayr."
                ),
                view: MessageSnippet(text: "No budget yet")
            )
        }

        return .result(
            value: found.remaining,
            dialog: IntentDialog(
                "\(found.remaining) \(found.remainingCaption) \(found.periodLabel) in \(found.name) — \(found.percent) spent."
            ),
            view: FigureSnippet(
                eyebrow: "\(found.name.uppercased()) · \(found.periodLabel.uppercased())",
                figure: found.remaining,
                caption: found.remainingCaption.uppercased(),
                detail: "\(found.spent) of \(found.limit)"
            )
        )
    }
}

struct SpendingSummaryIntent: AppIntent {
    static var title: LocalizedStringResource = "Get Spending Summary"

    static var description = IntentDescription(
        "Reports what you spent, what came in, and where you net out this period."
    )

    static var openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        guard let snapshot = SharedStore.snapshot() else {
            return .result(
                dialog: IntentDialog("Open Outlayr once and I can report on it."),
                view: MessageSnippet(text: "No data yet")
            )
        }

        let insights = snapshot.insights
        let direction = insights.netPositive ? "up" : "down"
        return .result(
            dialog: IntentDialog(
                "\(insights.periodLabel.lowercased()) you spent \(insights.spent) and took in \(insights.income) — \(direction) \(insights.net)."
            ),
            view: FigureSnippet(
                eyebrow: "\(insights.periodLabel) · \(insights.rangeLabel)",
                figure: insights.netPositive ? insights.net : "−\(insights.net)",
                caption: "NET",
                detail: "\(insights.spent) out · \(insights.income) in"
            )
        )
    }
}

/// Colours are the system's semantic ones rather than the brand palette: a
/// snippet is drawn on Siri's own surface in whatever appearance the device is
/// in, so a pinned hex would put near-black text on a dark sheet.
private struct FigureSnippet: View {
    let eyebrow: String
    let figure: String
    let caption: String
    let detail: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(eyebrow)
                .font(.system(size: 10, weight: .medium, design: .monospaced))
                .foregroundStyle(.secondary)
                .lineLimit(1)

            HStack(alignment: .firstTextBaseline, spacing: 5) {
                Text(figure)
                    .font(.system(size: 32, weight: .semibold, design: .rounded))
                Text(caption)
                    .font(.system(size: 10, weight: .medium, design: .monospaced))
                    .foregroundStyle(.secondary)
            }

            Divider()

            Text(detail)
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
    }
}

private struct MessageSnippet: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.system(size: 15, weight: .medium, design: .rounded))
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
    }
}
