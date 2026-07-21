//
//  FilteredInsightsViews.swift
//  Outlayr
//

import CoreData
import Foundation
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
            let categoryPredicate = NSPredicate(format: "category == %@ OR category.parent == %@", unwrappedCategory, unwrappedCategory)
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
