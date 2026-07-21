//
//  FilteredCategoryDayBudgetView.swift
//  Outlayr
//

import Foundation
import CoreData
import SwiftUI

struct FilteredCategoryDayBudgetView: View {
    @FetchRequest private var transactions: FetchedResults<Transaction>
    @Binding var totalSpent: Double
    @AppStorage(DefaultsKey.currency, store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency)!
    }

    var date: Date

    @Environment(\.managedObjectContext) var moc
    @Environment(DataController.self) private var dataController
    @AppStorage(DefaultsKey.showCents, store: AppIdentifiers.sharedDefaults) var showCents: Bool = true
    @AppStorage(DefaultsKey.swapTimeLabel, store: AppIdentifiers.sharedDefaults) var swapTimeLabel: Bool = false
    @AppStorage(DefaultsKey.showExpenseOrIncomeSign, store: AppIdentifiers.sharedDefaults)
    var showExpenseOrIncomeSign: Bool = true

    var body: some View {
        VStack(spacing: 0) {
            if transactions.count == 0 {
                NoResultsView(fullscreen: false)
            } else {
                ForEach(transactions, id: \.id) { transaction in
                    SingleTransactionView(transaction: transaction, showCents: showCents, currencySymbol: currencySymbol, currency: currency, swapTimeLabel: swapTimeLabel, future: false, showExpenseOrIncomeSign: showExpenseOrIncomeSign)
                }
            }
        }
        .onAppear {
            DispatchQueue.main.async {
                var holding = 0.0
                transactions.forEach { transaction in

                    holding += transaction.wrappedAmount
                }

                totalSpent = holding
            }
        }
        .onChange(of: date) { _, _ in
            DispatchQueue.main.async {
                var holding = 0.0
                transactions.forEach { transaction in

                    holding += transaction.wrappedAmount
                }

                totalSpent = holding
            }
        }
        .frame(maxHeight: .infinity)
    }

    init(category: Category?, day: Date, totalSpent: Binding<Double>) {
        date = day

        let datePredicate = NSPredicate(format: "%K == %@", #keyPath(Transaction.day), day as CVarArg)
        let dateCapPredicate = NSPredicate(format: "%K <= %@", #keyPath(Transaction.date), Date.now as CVarArg)
        let incomePredicate = NSPredicate(format: "income = %d", false)

        if let unwrappedCategory = category {
            let categoryPredicate = NSPredicate(format: "category == %@ OR category.parent == %@", unwrappedCategory, unwrappedCategory)

            let andPredicate = NSCompoundPredicate(type: .and, subpredicates: [datePredicate, categoryPredicate, incomePredicate, dateCapPredicate])

            _transactions = FetchRequest<Transaction>(sortDescriptors: [
                SortDescriptor(\.date, order: .reverse)
            ], predicate: andPredicate)
        } else {
            let andPredicate = NSCompoundPredicate(type: .and, subpredicates: [datePredicate, incomePredicate, dateCapPredicate])

            _transactions = FetchRequest<Transaction>(sortDescriptors: [
                SortDescriptor(\.date, order: .reverse)
            ], predicate: andPredicate)
        }

        _totalSpent = totalSpent
    }
}
