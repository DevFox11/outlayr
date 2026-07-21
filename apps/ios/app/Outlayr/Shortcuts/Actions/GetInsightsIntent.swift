//
//  GetInsightsIntent.swift
//  Outlayr
//
//  Created by Rafael Soh on 5/8/23.
//

import AppIntents
import Foundation
import SwiftUI

@available(iOS 16.4, *)
struct GetInsightsIntent: AppIntent {
    static var title: LocalizedStringResource = "Get Insights"

    static var description =
        IntentDescription("Extracts your total expenditure or income for a particular time period")

    @Parameter(title: "Type", description: "Type of Data", requestValueDialog: IntentDialog("Which of the following would you like to extract?"))
    var type: ShortcutsInsightsType

    @Parameter(title: "Time Frame", description: "Time Frame of Data", requestValueDialog: IntentDialog("Over what time frame would you like to consider?"))
    var timeframe: ShortcutsInsightsTimeFrame

    @Parameter(title: "Category Filters", description: "Additional Category Filters", requestValueDialog: IntentDialog("Which additional category filters do you want to impose?"))
    var incomeCategories: [IncomeCategoryEntity]?

    @Parameter(title: "Category Filters", description: "Additional Category Filters", requestValueDialog: IntentDialog("Which additional category filters do you want to impose?"))
    var expenseCategories: [ExpenseCategoryEntity]?

    @MainActor
    func perform() async throws -> some ReturnsValue<Double> & ShowsSnippetView & ProvidesDialog {
        guard DataController.storeIsAvailable else {
            // Broken app group: fail loudly instead of returning 0, which would
            // masquerade as a genuinely empty ledger.
            throw DataController.appGroupUnavailableError
        }

        let dataController = DataController.shared
//        let dataController = DataController()

        let categories: [Category]
        let optionalIncome: Bool?
        let typeInt: Int

        switch type {
        case .net:
            categories = []
            optionalIncome = nil
            typeInt = 1
        case .income:
            if let unwrappedCategories = incomeCategories {
                categories = unwrappedCategories.compactMap { category in
                    try? dataController.categories.findCategory(withId: category.id)
                }
            } else {
                categories = []
            }

            optionalIncome = true
            typeInt = 2
        case .spent:
            if let unwrappedCategories = expenseCategories {
                categories = unwrappedCategories.compactMap { category in
                    try? dataController.categories.findCategory(withId: category.id)
                }
            } else {
                categories = []
            }
            optionalIncome = false
            typeInt = 3
        }

        let result = dataController.transactions.getShortcutInsights(type: typeInt, timeframe: timeframe.rawValue, optionalIncome: optionalIncome, categories: categories)

        return .result(value: result, dialog: "Here you go!") {
            ShortcutInsightsView(amount: result, type: type, timeframe: timeframe)
        }
    }

    static var parameterSummary: some ParameterSummary {
        Switch(\GetInsightsIntent.$type) {
            Case(ShortcutsInsightsType.net) {
                Summary("Calculate \(\.$type) for \(\.$timeframe)")
            }
            Case(ShortcutsInsightsType.income) {
                Summary("Calculate \(\.$type) for \(\.$timeframe)") {
                    \.$incomeCategories
                }
            }
            Case(ShortcutsInsightsType.spent) {
                Summary("Calculate \(\.$type) for \(\.$timeframe)") {
                    \.$expenseCategories
                }
            }
            DefaultCase {
                Summary("Calculate \(\.$type) for \(\.$timeframe)")
            }
        }
    }
}
