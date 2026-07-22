//
//  FilteredBudgetView.swift
//  Outlayr
//

import Foundation
import CoreData
import SwiftUI

struct FilteredBudgetView: View {
    @SectionedFetchRequest<Date?, Transaction> private var transactions: SectionedFetchResults<Date?, Transaction>

    @Binding var totalSpent: Double
    var date: Date

    var body: some View {
        VStack(spacing: 30) {
            if transactions.count == 0 {
                NoResultsView(fullscreen: false)
            }

            ListView(transactions: _transactions)
        }
        .frame(maxHeight: .infinity)
        .onAppear {
            var holding = 0.0
            transactions.forEach { day in

                day.forEach { transaction in
                    holding += transaction.wrappedAmount
                }
            }

            totalSpent = holding
        }
        .onChange(of: date) { _, _ in
            var holding = 0.0
            transactions.forEach { day in

                day.forEach { transaction in
                    holding += transaction.wrappedAmount
                }
            }
            totalSpent = holding
        }
    }

    init(category: Category? = nil, startDate: Date, totalSpent: Binding<Double>, type: Int) {
        date = startDate

        let startPredicate = NSPredicate(format: "%K >= %@", #keyPath(Transaction.date), startDate as CVarArg)
        let incomePredicate = NSPredicate(format: "income = %d", false)
        let endPredicate: NSPredicate

        var calendar = Calendar(identifier: .gregorian)

        calendar.firstWeekday = AppIdentifiers.defaults.integer(forKey: DefaultsKey.firstWeekday)
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

        if let unwrappedCategory = category {
            let categoryPredicate = NSPredicate(format: "category == %@ OR category.parent == %@", unwrappedCategory, unwrappedCategory)

            let andPredicate = NSCompoundPredicate(type: .and, subpredicates: [startPredicate, endPredicate, categoryPredicate, incomePredicate])

            _transactions = SectionedFetchRequest<Date?, Transaction>(sectionIdentifier: \.day, sortDescriptors: [
                SortDescriptor(\.day, order: .reverse),
                SortDescriptor(\.date, order: .reverse)
            ], predicate: andPredicate)
        } else {
            let andPredicate = NSCompoundPredicate(type: .and, subpredicates: [startPredicate, endPredicate, incomePredicate])

            _transactions = SectionedFetchRequest<Date?, Transaction>(sectionIdentifier: \.day, sortDescriptors: [
                SortDescriptor(\.day, order: .reverse),
                SortDescriptor(\.date, order: .reverse)
            ], predicate: andPredicate)
        }

        _totalSpent = totalSpent
    }
}
