//
//  MainBudgetView.swift
//  xpenz
//
//  Created by Rafael Soh on 20/5/22.
//

import CoreData
import Foundation
import SwiftUI

struct MainBudgetView: View {
    let budget: MainBudget
    @FetchRequest<Transaction> private var transactions: FetchedResults<Transaction>

    @Environment(\.managedObjectContext) var moc
    @Environment(DataController.self) private var dataController

    @State var toEdit: MainBudget?
    @State var toDelete: MainBudget?
    @State var totalSpent: Double = 0

    var soloBudget: Bool

    var budgetAmount: Double {
        if budget.isFault {
            return 0.0
        }

        return budget.amount
    }

    var budgetType: String {
        if budget.isFault {
            return ""
        }

        switch budget.type {
        case 1:
            return String(localized: "today")
        case 2:
            return String(localized: "this week")
        case 3:
            return String(localized: "this month")
        case 4:
            return String(localized: "this year")
        default:
            return "this week"
        }
    }

    @AppStorage(DefaultsKey.currency, store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency)!
    }

    var percentageOfDays: Double {
        let calendar = Calendar.current

        if budget.isFault {
            return 0.0
        }

        if budget.type == 1 {
            let components = calendar.dateComponents([.minute], from: budget.wrappedDate, to: Date.now)
            return Double(components.minute ?? 0) / 1440
        }

        let components1 = calendar.dateComponents([.day], from: budget.wrappedDate, to: budget.endDate)
        let numberOfDays = components1.day ?? 0

        let components2 = calendar.dateComponents([.day], from: budget.wrappedDate, to: Date.now)
        let numberOfDaysPast = components2.day ?? 0

        return Double(numberOfDaysPast) / Double(numberOfDays)
    }

    var targetPercent: Double {
        let calendar = Calendar.current

        if budget.isFault {
            return 0.0
        }

        let components1 = calendar.dateComponents([.day], from: budget.wrappedDate, to: budget.endDate)
        let numberOfDays = components1.day ?? 0

        let components2 = calendar.dateComponents([.day], from: budget.wrappedDate, to: Date.now)
        let numberOfDaysPast = (components2.day ?? 0) + 1

        return Double(numberOfDays - numberOfDaysPast) / Double(numberOfDays)
    }

    var triangleOffset: (x: Double, y: Double) {
        var x = 0.0
        var y = -5.0

        let radius = (width / 2) - 5

        if targetPercent > 0.5 {
            let angle = (CGFloat.pi) * (1 - targetPercent)
            y += (radius - (radius * sin(angle)))
            x += (radius * cos(angle))
        } else if targetPercent < 0.5 {
            let angle = (CGFloat.pi) * targetPercent
            y += (radius - (radius * sin(angle)))
            x -= (radius * cos(angle))
        }

        return (x, y)
    }

    var triangleRotation: Double {
        if targetPercent > 0.5 {
            return ((targetPercent - 0.5) / 0.5) * 90
        } else if targetPercent < 0.5 {
            return -((0.5 - targetPercent) / 0.5) * 90
        } else {
            return 0
        }
    }

    var difference: Double {
        return abs(budgetAmount - totalSpent)
    }

    var percentString: String {
        if !budget.isFault {
            return "\(Int(round(100 - (totalSpent / budgetAmount) * 100)))%"
        } else {
            return ""
        }
    }

    var percentString1: String {
        if !budget.isFault {
            return "\(Int(round((totalSpent / budgetAmount) * 100)))%"
        } else {
            return ""
        }
    }

    var width: CGFloat {
        if soloBudget {
            return UIScreen.main.bounds.width - 90
        } else {
            return 250
        }
    }

    @Environment(\.colorScheme) var colorScheme

    var body: some View {
        VStack(spacing: 5) {
            gaugeSection

            amountLabels
        }
        .padding(.bottom)
        .frame(width: width + 30, height: soloBudget ? 230 : 200, alignment: .bottom)
        .background(soloBudget ? Color.Outline.opacity(0.2) : Color.PrimaryBackground, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
        .contentShape(RoundedRectangle(cornerRadius: 13))
        .contextMenu {
            Button {
                toEdit = budget

            } label: {
                Label("Edit", systemImage: "pencil")
            }
            Button {
                toDelete = budget

            } label: {
                Label("Delete", systemImage: "xmark.bin")
            }
        }
        .onAppear {
            if budget.isFault {
                return
            }

            var holdingTotal = 0.0
            transactions.forEach { transaction in
                holdingTotal += transaction.wrappedAmount
            }

            totalSpent = holdingTotal
        }
        .sheet(item: $toEdit, onDismiss: {
            toEdit = nil
        }) { budget in
            NewBudgetView(overallBudgetCreated: true, toEditMainBudget: budget)
        }
        .deleteMainBudgetConfirmation($toDelete)
    }

    private var gaugeSection: some View {
        ZStack(alignment: .bottom) {
                ZStack {
                    DonutSemicircle(percent: 1, cornerRadius: 6.5, width: soloBudget ? 35 : 25)
                        .fill(Color.SecondaryBackground)
                        .frame(width: width, height: width / 2)

                    if totalSpent / budgetAmount < 0.97 {
                        AnimatedCurvedBarGraphMainBudget(transactions: transactions, budgetTotal: budgetAmount, cornerRadius: 6.5, width: soloBudget ? 35 : 25)
                            .frame(width: width, height: width / 2)
                    }
                }
                .overlay(alignment: .top) {
                    if budget.type != 1 && totalSpent < budgetAmount && targetPercent > 0 {
                        RoundedTriangle(cornerRadius: 2)

                            .fill((targetPercent * budgetAmount) < (budgetAmount - totalSpent) ? Color.SubtitleText : Color.BudgetRed)
                            .frame(width: 20, height: 10)
                            .rotationEffect(Angle(degrees: triangleRotation), anchor: .bottom)
                            .offset(x: triangleOffset.x, y: triangleOffset.y)
                    }
                }

                CurvedText(text: String(localized: "OVERALL SPENT: \(percentString1)"), radius: width / 2 + 8)
                    .font(.system(.footnote, design: .rounded).weight(.medium))
                    .foregroundStyle(Color.SubtitleText)
                    .frame(width: width, height: 10)

                VStack(spacing: -4) {
                    let internalWidth = soloBudget ? width - 90 : width - 60
                    BudgetDollarView(amount: difference, red: totalSpent >= budgetAmount, scale: 3, size: internalWidth)
                        .frame(width: internalWidth)

                    Text("\(budgetAmount >= totalSpent ? "left" : "over") \(budgetType)")
                        .font(.system(.subheadline, design: .rounded).weight(.medium))
                        .foregroundStyle(Color.SubtitleText)
                }
            }
    }

    private var amountLabels: some View {
        HStack {
                if totalSpent < 1000 && budgetAmount < 1000 {
                    Text("\(totalSpent, specifier: "%.2f")")
                        .frame(width: 60, alignment: .leading)
                    Spacer()
                    Text("\(budgetAmount, specifier: "%.2f")")
                        .frame(width: 60, alignment: .trailing)
                } else {
                    Text("\(Int(round(totalSpent)))")
                        .frame(width: 60, alignment: .leading)
                    Spacer()
                    Text("\(Int(round(budgetAmount)))")
                        .frame(width: 60, alignment: .trailing)
                }
            }
            .font(.system(.caption2, design: .rounded).weight(.medium))
            .frame(width: width)
            .foregroundStyle(Color.SubtitleText)
    }

    init(budget: MainBudget, solo: Bool) {
        self.budget = budget
        soloBudget = solo

        let startPredicate = NSPredicate(format: "%K >= %@", #keyPath(Transaction.date), budget.wrappedDate as CVarArg)
        let endPredicate = NSPredicate(format: "%K <= %@", #keyPath(Transaction.date), Date.now as CVarArg)
        let incomePredicate = NSPredicate(format: "income = %d", false)

        let andPredicate = NSCompoundPredicate(type: .and, subpredicates: [startPredicate, endPredicate, incomePredicate])

        _transactions = FetchRequest<Transaction>(sortDescriptors: [], predicate: andPredicate)
    }
}
