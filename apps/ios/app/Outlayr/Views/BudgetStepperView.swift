//
//  BudgetStepperView.swift
//  Outlayr
//

import Foundation
import CoreData
import SwiftUI

struct BudgetStepperView: View {
    @FetchRequest private var transactions: FetchedResults<Transaction>

    @Binding var date: Date
    var firstDate: Date {
        if transactions.isEmpty {
            return Date.now
        } else {
            return transactions[0].day ?? Date.now
        }
    }

    var endDate: Date {
        if type == 1 {
            return Calendar.current.date(byAdding: .day, value: 1, to: date)!
        } else if type == 2 {
            return Calendar.current.date(byAdding: .day, value: 6, to: date)!
        } else if type == 3 {
            let holdingDate = Calendar.current.date(byAdding: .month, value: 1, to: date)!
            return Calendar.current.date(byAdding: .day, value: -1, to: holdingDate)!
        } else if type == 4 {
            let holdingDate = Calendar.current.date(byAdding: .year, value: 1, to: date)!
            return Calendar.current.date(byAdding: .day, value: -1, to: holdingDate)!
        }

        return startDate
    }

    let startDate: Date
    let type: Int

    var dateString: String {
        let dateFormatter = DateFormatter()

        if type == 1 {
            dateFormatter.dateFormat = "d MMM yyyy"
            return dateFormatter.string(from: date)
        } else if type == 4 {
            dateFormatter.dateFormat = "d MMM yy"
            return dateFormatter.string(from: date) + " - " + dateFormatter.string(from: endDate)
        } else {
            dateFormatter.dateFormat = "d MMM"
            return dateFormatter.string(from: date) + " - " + dateFormatter.string(from: endDate)
        }
    }

    var body: some View {
        HStack {
            StepperButtonView(left: true, disabled: date <= firstDate) {
                if date > firstDate {
                    if type == 1 {
                        date = Calendar.current.date(byAdding: .day, value: -1, to: date)!
                    } else if type == 2 {
                        date = Calendar.current.date(byAdding: .day, value: -7, to: date)!
                    } else if type == 3 {
                        date = Calendar.current.date(byAdding: .month, value: -1, to: date)!
                    } else if type == 4 {
                        date = Calendar.current.date(byAdding: .year, value: -1, to: date)!
                    }
                }
            }

            Spacer()

            Text(dateString)
                .font(.system(.title3, design: .rounded).weight(.bold))

            Spacer()

            StepperButtonView(left: false, disabled: date == startDate) {
                if date < startDate {
                    if type == 1 {
                        date = Calendar.current.date(byAdding: .day, value: 1, to: date)!
                    } else if type == 2 {
                        date = Calendar.current.date(byAdding: .day, value: 7, to: date)!
                    } else if type == 3 {
                        date = Calendar.current.date(byAdding: .month, value: 1, to: date)!
                    } else if type == 4 {
                        date = Calendar.current.date(byAdding: .year, value: -1, to: date)!
                    }
                }
            }
        }
        .frame(maxWidth: .infinity)
    }

    init(category: Category?, date: Binding<Date>, startDate: Date, budgetType: Int) {
        if let unwrappedCategory = category {
            _transactions = FetchRequest<Transaction>(sortDescriptors: [
                SortDescriptor(\.day)
            ], predicate: NSPredicate(format: "%K == %@", #keyPath(Transaction.category), unwrappedCategory))
        } else {
            _transactions = FetchRequest<Transaction>(sortDescriptors: [
                SortDescriptor(\.day)
            ])
        }

        _date = date

        self.startDate = startDate
        type = budgetType
    }
}
