//
//  DateStepperView.swift
//  Outlayr
//

import CoreData
import Foundation
import SwiftUI

struct DateStepperView: View {
    @FetchRequest(sortDescriptors: [
        SortDescriptor(\.day)
    ]) private var transactions: FetchedResults<Transaction>

    @Binding var date: Date
    var endDate: Date {
        if transactions.isEmpty {
            return Date.now
        } else {
            return transactions[0].day ?? Date.now
        }
    }

    let currentDate = Calendar.current.date(bySettingHour: 0, minute: 0, second: 0, of: Date.now) ?? Date.now

    var dateString: String {
        let dateFormatter = DateFormatter()

        dateFormatter.dateFormat = "d MMM yyyy"

        return dateFormatter.string(from: date)
    }

    var body: some View {
        HStack {
            StepperButtonView(left: true, disabled: date <= endDate) {
                if date > endDate {
                    date = Calendar.current.date(byAdding: .day, value: -1, to: date) ?? Date.now
                }
            }
            .accessibilityLabel(String(localized: "accessibility.previousDay"))

            Spacer()

            Text(dateString)
                .font(.system(.title3, design: .rounded).weight(.bold))
                .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                .font(.system(size: 20, weight: .bold, design: .rounded))
                .accessibilityLabel(String(format: String(localized: "accessibility.showingTransactionsOn"), dateString))

            Spacer()

            StepperButtonView(left: false, disabled: date >= currentDate) {
                if date < currentDate {
                    date = Calendar.current.date(byAdding: .day, value: 1, to: date) ?? Date.now
                }
            }
            .accessibilityLabel(String(localized: "accessibility.nextDay"))
        }
        .frame(maxWidth: .infinity)
        .onAppear {
            date = currentDate
        }
    }
}
