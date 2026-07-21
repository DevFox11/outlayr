//
//  BudgetInsightsIntent.swift
//  Outlayr
//
//  Created by Rafael Soh on 6/8/23.
//

import AppIntents
import Foundation
import SwiftUI

@available(iOS 16.4, *)
struct BudgetIntent: AppIntent {
    static var title: LocalizedStringResource = "Get Budget Insights"

    static var description =
        IntentDescription("Extract leftover amount for a particular budget")

    @Parameter(title: "Budget Type", requestValueDialog: IntentDialog("What budget type would you like to extract insights from?"))
    var type: ShortcutsBudgetsType

    @Parameter(title: "Category Budget", requestValueDialog: IntentDialog("Select a categorical budget."))
    var budget: BudgetEntity?

    @MainActor
    func perform() async throws -> some ReturnsValue<Double> & ShowsSnippetView & ProvidesDialog {
        guard DataController.storeIsAvailable else {
            // Broken app group: fail loudly instead of returning 0 leftover, which
            // would masquerade as a real (fully-spent) budget figure.
            throw DataController.appGroupUnavailableError
        }

        if type == .category && budget == nil {
            throw $budget.needsValueError()
        }

//        let dataController = DataController()

        let dataController = DataController.shared

        var amount: Double = 0
        var budgetType: Int16 = 0

        switch type {
        case .overall:
            if let mainBudget = dataController.results(for: dataController.fetchRequestForMainBudget()).first {
                amount = dataController.getBudgetLeftover(overallBudget: mainBudget)

                budgetType = mainBudget.type
            }
        case .category:
            if let unwrappedBudget = budget {
                let categoryBudget = try dataController.findBudget(withId: unwrappedBudget.id)

                amount = dataController.getBudgetLeftover(budget: categoryBudget)

                budgetType = categoryBudget.type
            }
        }

        return .result(value: amount, dialog: "Here you go!") {
            ShortcutBudgetView(amount: amount, type: Int(budgetType))
        }
    }

    static var parameterSummary: some ParameterSummary {
        Switch(\BudgetIntent.$type) {
            Case(ShortcutsBudgetsType.category) {
                Summary("Calculate leftover amount for the \(\.$budget) \(\.$type)")
            }
            Case(ShortcutsBudgetsType.overall) {
                Summary("Calculate leftover amount for the \(\.$type)")
            }
            DefaultCase {
                Summary("Calculate leftover amount for the \(\.$type)")
            }
        }
    }
}
