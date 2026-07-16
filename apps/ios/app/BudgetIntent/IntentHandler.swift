//
//  IntentHandler.swift
//  BudgetIntent
//
//  Created by Rafael Soh on 17/8/22.
//

import Intents

class IntentHandler: INExtension, BudgetWidgetConfigurationIntentHandling {
//    let dataController = DataController()
    let dataController = DataController.shared

    func provideBudgetOptionsCollection(for _: BudgetWidgetConfigurationIntent, with completion: @escaping (INObjectCollection<WidgetBudget>?, Error?) -> Void) {
        guard DataController.storeIsAvailable else {
            // Broken app group: fail the intent request instead of returning an
            // empty budget list that looks like the user has no budgets.
            completion(nil, DataController.appGroupUnavailableError)
            return
        }

        let budgetFetchRequest = dataController.fetchRequestForBudgets()

        let budgets = dataController.results(for: budgetFetchRequest).map {
            WidgetBudget(identifier: $0.objectID.uriRepresentation().absoluteString, display: $0.wrappedName)
        }

        let collection = INObjectCollection(items: budgets)
        completion(collection, nil)
    }

    override func handler(for _: INIntent) -> Any {
        // This is the default implementation.  If you want different objects to handle different intents,
        // you can override this and return the handler you want for that particular intent.

        return self
    }
}
