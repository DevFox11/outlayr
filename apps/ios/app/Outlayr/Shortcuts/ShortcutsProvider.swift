//
//  ShortcutsProvider.swift
//  Outlayr
//
//  Created by Rafael Soh on 5/8/23.
//

import AppIntents
import Foundation

@available(iOS 16.4, *)
struct OutlayrShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: NewTransactionIntent(),
            phrases: ["Log a new transaction in \(.applicationName)"],
            shortTitle: "New Transaction",
            systemImageName: "books.vertical.fill"
        )
        AppShortcut(
            intent: GetInsightsIntent(),
            phrases: ["Get insights in \(.applicationName)"],
            shortTitle: "Get Insights",
            systemImageName: "plusminus.circle.fill"
        )
        AppShortcut(
            intent: BudgetIntent(),
            phrases: ["Extract leftover amount for your budgets in \(.applicationName)"],
            shortTitle: "Budget Leftover",
            systemImageName: "circle.grid.2x2.fill"
        )
    }
}
