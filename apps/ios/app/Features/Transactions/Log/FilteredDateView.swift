//
//  FilteredDateView.swift
//  Outlayr

import CoreData
import Foundation
import SwiftUI

struct FilteredDateView: View {
    @FetchRequest private var transactions: FetchedResults<Transaction>

    var date: Date

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
                NoResultsView(fullscreen: true)
            }
            ForEach(transactions) { transaction in
                SingleTransactionView(transaction: transaction, showCents: showCents, currencySymbol: currencySymbol, currency: currency, swapTimeLabel: swapTimeLabel, future: false, showExpenseOrIncomeSign: showExpenseOrIncomeSign)
            }
        }
        .frame(maxHeight: .infinity)
    }

    init(date: Date) {
        let datePredicate = NSPredicate(format: "%K == %@", #keyPath(Transaction.day), date as CVarArg)
        let futurePredicate = NSPredicate(format: "%K <= %@", #keyPath(Transaction.date), Date.now as CVarArg)

        let andPredicate = NSCompoundPredicate(type: .and, subpredicates: [futurePredicate, datePredicate])

        _transactions = FetchRequest<Transaction>(sortDescriptors: [
            SortDescriptor(\.date, order: .reverse)
        ], predicate: andPredicate)

        self.date = date
    }
}
