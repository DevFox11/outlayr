//
//  FilteredCategoryView.swift
//  Outlayr
//

import CoreData
import Foundation
import SwiftUI

struct FilteredCategoryView: View {
    @SectionedFetchRequest<Date?, Transaction> private var transactions: SectionedFetchResults<Date?, Transaction>

    var category: Category?

    var body: some View {
        VStack(spacing: 30) {
            if transactions.count == 0 || category == nil {
                NoResultsView(fullscreen: true)
            } else {
                ListView(transactions: _transactions)
            }
        }
        .frame(maxHeight: .infinity)
    }

    init(category: Category?) {
        if let unwrappedCategory = category {
            let categoryPredicate = NSPredicate(format: "category == %@ OR category.parent == %@", unwrappedCategory, unwrappedCategory)
            let datePredicate = NSPredicate(format: "%K <= %@", #keyPath(Transaction.date), Date.now as CVarArg)

            let andPredicate = NSCompoundPredicate(type: .and, subpredicates: [categoryPredicate, datePredicate])

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

        self.category = category
    }
}
