//
//  FilteredRecurringView.swift
//  Outlayr
//

import CoreData
import Foundation
import SwiftUI

struct FilteredRecurringView: View {
    @SectionedFetchRequest<Date?, Transaction> private var transactions: SectionedFetchResults<Date?, Transaction>

    var body: some View {
        VStack(spacing: 30) {
            if transactions.count == 0 {
                NoResultsView(fullscreen: true)
            }

            ListView(transactions: _transactions)
        }
        .frame(maxHeight: .infinity)
    }

    init() {
        let recurringPredicate = NSPredicate(format: "%K = %d", #keyPath(Transaction.onceRecurring), true)
        let datePredicate = NSPredicate(format: "%K <= %@", #keyPath(Transaction.date), Date.now as CVarArg)

        let andPredicate = NSCompoundPredicate(type: .and, subpredicates: [recurringPredicate, datePredicate])

        _transactions = SectionedFetchRequest<Date?, Transaction>(sectionIdentifier: \.day, sortDescriptors: [
            SortDescriptor(\.day, order: .reverse),
            SortDescriptor(\.date, order: .reverse),
            SortDescriptor(\.note, order: .reverse)
        ], predicate: andPredicate)
    }
}
