//
//  FilteredInsightsViews.swift
//  Outlayr

import CoreData
import Foundation
import SwiftUI

struct FilteredDateInsightsView: View {
    @FetchRequest private var transactions: FetchedResults<Transaction>

    @AppStorage(DefaultsKey.currency, store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency)!
    }

    @AppStorage(DefaultsKey.swapTimeLabel, store: AppIdentifiers.sharedDefaults) var swapTimeLabel: Bool = false
    @AppStorage(DefaultsKey.showCents, store: AppIdentifiers.sharedDefaults) var showCents: Bool = true

    @AppStorage(DefaultsKey.showExpenseOrIncomeSign, store: AppIdentifiers.sharedDefaults)
    var showExpenseOrIncomeSign: Bool = true

    var body: some View {
        VStack(spacing: 0) {
            if transactions.count == 0 {
                NoResultsView(fullscreen: false)
            }
            ForEach(transactions) { transaction in
                SingleTransactionView(transaction: transaction, showCents: showCents, currencySymbol: currencySymbol, currency: currency, swapTimeLabel: swapTimeLabel, future: false, showExpenseOrIncomeSign: showExpenseOrIncomeSign)
            }
        }
        .frame(maxHeight: .infinity)
    }

    init(date: Date, income: Bool) {
        let startPredicate = NSPredicate(format: "%K >= %@", #keyPath(Transaction.date), date as CVarArg)

        let endPredicate: NSPredicate

        let calendar = Calendar.current

        if calendar.isDate(date, equalTo: Date.now, toGranularity: .day) {
            endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), Date.now as CVarArg)
        } else {
            let next = calendar.date(byAdding: .day, value: 1, to: date) ?? Date.now
            endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), next as CVarArg)
        }

        let incomePredicate = NSPredicate(format: "income = %d", income)

        let andPredicate = NSCompoundPredicate(type: .and, subpredicates: [startPredicate, incomePredicate, endPredicate])

        _transactions = FetchRequest<Transaction>(sortDescriptors: [
            SortDescriptor(\.date, order: .reverse)
        ], predicate: andPredicate)
    }
}
