//
//  MonthStepperView.swift
//  Outlayr
//

import CoreData
import Foundation
import SwiftUI

struct MonthStepperView: View {
    @FetchRequest(sortDescriptors: [
        SortDescriptor(\.day)
    ]) private var transactions: FetchedResults<Transaction>

    @FetchRequest(sortDescriptors: [
        SortDescriptor(\.day, order: .reverse)
    ], predicate: NSPredicate(format: "%K < %@", #keyPath(Transaction.date), Date.now as CVarArg)) private var transactionsReversed: FetchedResults<Transaction>

    @Binding var showingDate: Date
    var endDate: Date {
        if transactions.isEmpty {
            return Date.now
        } else {
            let calendar = Calendar(identifier: .gregorian)

            let date = transactions[0].day ?? Date.now

            let dateComponents = calendar.dateComponents([.month, .year], from: date)

            return calendar.date(from: dateComponents) ?? Date.now
        }
    }

    @State var startDate = Date.now

    var dateString: String {
        let dateFormatter = DateFormatter()

        dateFormatter.dateFormat = "MMM yyyy"

        return dateFormatter.string(from: showingDate)
    }

    var body: some View {
        HStack {
            StepperButtonView(left: true, disabled: showingDate == endDate) {
                if showingDate > endDate {
                    showingDate = Calendar.current.date(byAdding: .month, value: -1, to: showingDate) ?? Date.now
                }
            }
            .accessibilityLabel("previous month")

            Spacer()

            Text(dateString)
                .font(.system(.title3, design: .rounded).weight(.bold))
                .accessibilityLabel("showing transactions in \(dateString)")

            Spacer()

            StepperButtonView(left: false, disabled: showingDate == startDate) {
                if showingDate < startDate {
                    showingDate = Calendar.current.date(byAdding: .month, value: 1, to: showingDate) ?? Date.now
                }
            }
            .accessibilityLabel("next month")
        }
        .frame(maxWidth: .infinity)
        .onAppear {
            let calendar = Calendar(identifier: .gregorian)

            let date = transactionsReversed[0].day ?? Date.now

            let dateComponents = calendar.dateComponents([.month, .year], from: date)

            startDate = calendar.date(from: dateComponents) ?? Date.now

            showingDate = startDate
        }
    }
}
