//
//  FilteredInsightsViews.swift
//  Outlayr
//

import CoreData
import Foundation
import Popovers
import SwiftUI

struct FilteredCategoryInsightsView: View {
    @SectionedFetchRequest<Date?, Transaction> private var transactions: SectionedFetchResults<Date?, Transaction>

    var body: some View {
        VStack(spacing: 30) {
            if transactions.count == 0 {
                NoResultsView(fullscreen: false)
            }

            ListView(transactions: _transactions)
        }
        .frame(maxHeight: .infinity)
    }

    init(category: Category?, date: Date, type: ChartTimeFrame) {
        if let unwrappedCategory = category {
            let startPredicate = NSPredicate(format: "%K >= %@", #keyPath(Transaction.date), date as CVarArg)
            let categoryPredicate = NSPredicate(format: "%K == %@", #keyPath(Transaction.category), unwrappedCategory)
            let incomePredicate = NSPredicate(format: "income = %d", unwrappedCategory.income)

            let endPredicate: NSPredicate

            var calendar = Calendar(identifier: .gregorian)

            calendar.firstWeekday = AppIdentifiers.sharedDefaults!.integer(forKey: "firstWeekday")
            calendar.minimumDaysInFirstWeek = 4

            switch type {
            case .week:
                if calendar.isDate(date, equalTo: Date.now, toGranularity: .weekOfYear) {
                    endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), Date.now as CVarArg)
                } else {
                    let next = calendar.date(byAdding: .day, value: 7, to: date) ?? Date.now
                    endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), next as CVarArg)
                }
            case .month:
                if calendar.isDate(date, equalTo: Date.now, toGranularity: .month) {
                    endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), Date.now as CVarArg)
                } else {
                    let next = calendar.date(byAdding: .month, value: 1, to: date) ?? Date.now
                    endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), next as CVarArg)
                }
            case .year:
                if calendar.isDate(date, equalTo: Date.now, toGranularity: .year) {
                    endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), Date.now as CVarArg)
                } else {
                    let next = calendar.date(byAdding: .year, value: 1, to: date) ?? Date.now
                    endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), next as CVarArg)
                }
            }

            let andPredicate = NSCompoundPredicate(type: .and, subpredicates: [startPredicate, endPredicate, categoryPredicate, incomePredicate])

            _transactions = SectionedFetchRequest<Date?, Transaction>(sectionIdentifier: \.day, sortDescriptors: [
                SortDescriptor(\.day, order: .reverse),
                SortDescriptor(\.date, order: .reverse)
            ], predicate: andPredicate)

        } else {
            _transactions = SectionedFetchRequest<Date?, Transaction>(sectionIdentifier: \.day, sortDescriptors: [
                SortDescriptor(\.day, order: .reverse),
                SortDescriptor(\.date, order: .reverse)
            ])
        }
    }
}

struct FilteredDateInsightsView: View {
    @FetchRequest private var transactions: FetchedResults<Transaction>

    @AppStorage("currency", store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency)!
    }

    @AppStorage("swapTimeLabel", store: AppIdentifiers.sharedDefaults) var swapTimeLabel: Bool = false
    @AppStorage("showCents", store: AppIdentifiers.sharedDefaults) var showCents: Bool = true
    
    @AppStorage("showExpenseOrIncomeSign", store: AppIdentifiers.sharedDefaults)
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

struct FilteredInsightsView: View {
    @SectionedFetchRequest<Date?, Transaction> private var transactions: SectionedFetchResults<Date?, Transaction>

    var body: some View {
        VStack(spacing: 30) {
            if transactions.count == 0 {
                NoResultsView(fullscreen: false)
            }

            ListView(transactions: _transactions)
        }
        .frame(maxHeight: .infinity)
    }

    init(startDate: Date, income: Bool? = nil, type: Int) {
        let startPredicate = NSPredicate(format: "%K >= %@", #keyPath(Transaction.date), startDate as CVarArg)

        let endPredicate: NSPredicate

        var calendar = Calendar(identifier: .gregorian)

        calendar.firstWeekday = AppIdentifiers.sharedDefaults!.integer(forKey: "firstWeekday")
        calendar.minimumDaysInFirstWeek = 4

        if type == 1 {
            if calendar.isDate(startDate, equalTo: Date.now, toGranularity: .weekOfYear) {
                endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), Date.now as CVarArg)
            } else {
                let next = calendar.date(byAdding: .day, value: 7, to: startDate) ?? Date.now
                endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), next as CVarArg)
            }
        } else if type == 2 {
            if calendar.isDate(startDate, equalTo: Date.now, toGranularity: .month) {
                endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), Date.now as CVarArg)
            } else {
                let next = calendar.date(byAdding: .month, value: 1, to: startDate) ?? Date.now
                endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), next as CVarArg)
            }
        } else {
            if calendar.isDate(startDate, equalTo: Date.now, toGranularity: .year) {
                endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), Date.now as CVarArg)
            } else {
                let next = calendar.date(byAdding: .year, value: 1, to: startDate) ?? Date.now
                endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), next as CVarArg)
            }
        }

        let andPredicate: NSCompoundPredicate

        if let unwrappedIncome = income {
            let incomePredicate = NSPredicate(format: "income = %d", unwrappedIncome)
            andPredicate = NSCompoundPredicate(type: .and, subpredicates: [startPredicate, endPredicate, incomePredicate])

        } else {
            andPredicate = NSCompoundPredicate(type: .and, subpredicates: [startPredicate, endPredicate])
        }

        _transactions = SectionedFetchRequest<Date?, Transaction>(sectionIdentifier: \.day, sortDescriptors: [
            SortDescriptor(\.day, order: .reverse),
            SortDescriptor(\.date, order: .reverse)
        ], predicate: andPredicate)
    }
}
