import AppIntents

/// Every phrase must interpolate `.applicationName` or it will not compile.
struct OutlayrShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: LogTransactionIntent(),
            phrases: [
                "Log a transaction in \(.applicationName)",
                "Log an expense in \(.applicationName)",
                "Add an entry to \(.applicationName)"
            ],
            shortTitle: "Log a Transaction",
            systemImageName: "plus.circle.fill"
        )
        // The parameterised phrase binds the spoken name to a real budget via
        // `BudgetQuery`; the bare phrases keep the un-named question working.
        AppShortcut(
            intent: BudgetLeftoverIntent(),
            phrases: [
                "Check my budget in \(.applicationName)",
                "How much is left in \(.applicationName)",
                "How much is left in \(\.$budget) in \(.applicationName)",
                "Check my \(\.$budget) budget in \(.applicationName)"
            ],
            shortTitle: "Check Budget",
            systemImageName: "chart.pie.fill"
        )
        AppShortcut(
            intent: SpendingSummaryIntent(),
            phrases: [
                "Get my spending summary in \(.applicationName)",
                "How am I doing in \(.applicationName)"
            ],
            shortTitle: "Spending Summary",
            systemImageName: "arrow.up.arrow.down.circle.fill"
        )
    }
}
