//
//  FilteredSearchView.swift
//  Outlayr
//

import CoreData
import Foundation
import SwiftUI

struct FilteredSearchView: View {
    @SectionedFetchRequest<Date?, Transaction> private var transactions: SectionedFetchResults<Date?, Transaction>

    var searchQuery: String

    var body: some View {
        VStack {
            if searchQuery != "" && transactions.count == 0 {
                SearchEmptyState(kind: .noResults(query: searchQuery))
            }

            ListView(transactions: _transactions)
        }
        .frame(maxHeight: .infinity)
    }

    init(searchQuery: String) {
        let beginPredicate = NSPredicate(format: "%K BEGINSWITH[cd] %@", #keyPath(Transaction.note), searchQuery)
        let containPredicate = NSPredicate(format: "%K CONTAINS[cd] %@", #keyPath(Transaction.note), searchQuery)
        let containPredicate1 = NSPredicate(format: "%K CONTAINS[cd] %@", #keyPath(Transaction.category.name), searchQuery)

        let compound: NSCompoundPredicate

        // allow searching by amount too
        if let amount = Double(searchQuery) {
            let amountPredicate = NSPredicate(format: "amount == %@", NSNumber(value: amount))
            compound = NSCompoundPredicate(orPredicateWithSubpredicates: [beginPredicate, containPredicate, containPredicate1, amountPredicate])
        } else {
            compound = NSCompoundPredicate(orPredicateWithSubpredicates: [beginPredicate, containPredicate, containPredicate1])
        }

        _transactions = SectionedFetchRequest<Date?, Transaction>(sectionIdentifier: \.day, sortDescriptors: [
            SortDescriptor(\.day, order: .reverse),
            SortDescriptor(\.date, order: .reverse)
        ], predicate: compound)

        self.searchQuery = searchQuery
    }
}
