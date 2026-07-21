//
//  NewTransactionIntent.swift
//  Outlayr
//
//  Created by Rafael Soh on 23/7/23.
//

import AppIntents
import Foundation
import SwiftUI

@available(iOS 16.4, *)
struct NewTransactionIntent: AppIntent {
    static var title: LocalizedStringResource = "New Transaction"

    static var description =
        IntentDescription("Log new transactions in a blink")

    @Parameter(title: "Type", description: "Type of the transaction", requestValueDialog: IntentDialog("Would you like to log an income or expense?"))
    var income: TransactionType

    @Parameter(title: "Amount", description: "Value of the transaction", controlStyle: .field, inclusiveRange: (lowerBound: 0.01, upperBound: 100_000_000), requestValueDialog: IntentDialog("How much was transacted?"))
    var amount: Double

    @Parameter(title: "Category", description: "Category associated with the transaction", requestValueDialog: IntentDialog("What category does it come under?"))
    var incomeCategory: IncomeCategoryEntity?

    @Parameter(title: "Category", description: "Category associated with the transaction", requestValueDialog: IntentDialog("What category does it come under?"))
    var expenseCategory: ExpenseCategoryEntity?

    @Parameter(title: "Note")
    var note: String?

    @Parameter(title: "Recurring Transaction", default: false)
    var recurringTransaction: Bool

    @Parameter(title: "Recurring Frequency", default: .weekly)
    var recurringType: RepeatType

//    struct CategoryOptionsProvider: DynamicOptionsProvider {
//
//        func results() async throws -> ItemCollection<CategoryEntity> {
//            let dataController = DataController()
//
//            }
//
//            let incomeCategories = categories.filter { $0.income }
//            let expenseCategories = categories.filter { !$0.income }
//
//            return ItemCollection {
//                ItemSection(
//                    "Income Categories",
//                    items: incomeCategories.map {
//                        IntentItem<CategoryEntity>.init($0)
//                    }
//                )
//                ItemSection(
//                    "Expense Categories",
//                    items: expenseCategories.map {
//                        IntentItem<CategoryEntity>.init($0)
//                    }
//                )
//
//            }
//        }
//    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        guard DataController.storeIsAvailable else {
            // Broken app group: refuse before writing. Persisting to an unloaded
            // context would silently lose the transaction. Fail the intent loudly.
            throw DataController.appGroupUnavailableError
        }

        if expenseCategory == nil && incomeCategory == nil {
            if income == .expense {
                throw $expenseCategory.needsValueError()
            } else {
                throw $incomeCategory.needsValueError()
            }
        } else {
            if amount == 0 {
                throw $amount.needsValueError()
            }

            let dataController = DataController.shared
            let repeatType: Int

            if !recurringTransaction {
                repeatType = 0
            } else {
                switch recurringType {
                case .daily:
                    repeatType = 1
                case .weekly:
                    repeatType = 2
                case .monthly:
                    repeatType = 3
                }
            }

            if income == .expense {
                if let unwrappedExpenseCategory = expenseCategory {
                    let category = try dataController.findCategory(withId: unwrappedExpenseCategory.id)

                    let transaction = dataController.newTransaction(note: note ?? "", category: category, income: false, amount: amount, date: Date.now, repeatType: repeatType, repeatCoefficient: 1, delay: false)

                    return .result(dialog: "Expense successfully logged.") {
                        ShortcutTransactionView(transaction: transaction)
                    }
                } else {
                    throw $expenseCategory.needsValueError()
                }
            } else {
                if let unwrappedIncomeCategory = incomeCategory {
                    let category = try dataController.findCategory(withId: unwrappedIncomeCategory.id)

                    let transaction = dataController.newTransaction(note: note ?? "", category: category, income: true, amount: amount, date: Date.now, repeatType: repeatType, repeatCoefficient: 1, delay: false)

                    return .result(dialog: "Income successfully logged.") {
                        ShortcutTransactionView(transaction: transaction)
                    }
                } else {
                    throw $incomeCategory.needsValueError()
                }
            }
        }
    }

    static var parameterSummary: some ParameterSummary {
        Switch(\NewTransactionIntent.$income) {
            Case(TransactionType.expense) {
                When(\NewTransactionIntent.$recurringTransaction, .equalTo, true, {
                    Summary("Log an \(\.$income) of \(\.$amount) under \(\.$expenseCategory)") {
                        \.$note
                        \.$recurringTransaction
                        \.$recurringType
                    }
                }, otherwise: {
                    Summary("Log an \(\.$income) of \(\.$amount) under \(\.$expenseCategory)") {
                        \.$note
                        \.$recurringTransaction
                    }
                })
            }
            Case(TransactionType.income) {
                When(\NewTransactionIntent.$recurringTransaction, .equalTo, true, {
                    Summary("Log an \(\.$income) of \(\.$amount) under \(\.$incomeCategory)") {
                        \.$note
                        \.$recurringTransaction
                        \.$recurringType
                    }
                }, otherwise: {
                    Summary("Log an \(\.$income) of \(\.$amount) under \(\.$incomeCategory)") {
                        \.$note
                        \.$recurringTransaction
                    }
                })
            }
            DefaultCase {
                Summary("Log an \(\.$income) of \(\.$amount)") {
                    \.$note
                }
            }
        }
    }
}
