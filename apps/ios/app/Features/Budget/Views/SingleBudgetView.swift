//
//  SingleBudgetView.swift
//  xpenz
//
//  Created by Rafael Soh on 20/5/22.
//

import CoreData
import Foundation
import SwiftUI

struct SingleBudgetView: View {
    let budget: Budget
    @FetchRequest<Transaction> private var transactions: FetchedResults<Transaction>

    @Binding var toDelete: Budget?
    @Binding var toEdit: Budget?

    @State var totalSpent: Double = 0

    var budgetRows: Bool

    var width: CGFloat {
        ((UIScreen.main.bounds.width - 75) / 2) - 30
    }

    var rowWidth: CGFloat {
        (UIScreen.main.bounds.width - 80) / 2
    }

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

    var timeLeft: String {
        let calendar = Calendar.current

        if budget.isFault {
            return ""
        }

        if budgetRows {
            if budget.type == 1 {
                let components = calendar.dateComponents([.hour], from: budget.wrappedDate, to: Date.now)

                return String(localized: "\(24 - components.hour!)h left")
            } else if budget.type == 2 {
                let components = calendar.dateComponents([.day], from: budget.wrappedDate, to: Date.now)

                return String(localized: "\(7 - (components.day ?? 0))d left")
            } else {
                let components1 = calendar.dateComponents([.day], from: budget.wrappedDate, to: budget.endDate)
                let numberOfDays = components1.day ?? 0

                let components2 = calendar.dateComponents([.day], from: budget.wrappedDate, to: Date.now)
                let numberOfDaysPast = components2.day ?? 0

                let daysLeftNumber = Int(numberOfDays - numberOfDaysPast)
                return String(localized: "\(daysLeftNumber)d left"
                )
            }
        } else {
            if budget.type == 1 {
                let components = calendar.dateComponents([.hour], from: budget.wrappedDate, to: Date.now)

                return String(localized: "\(24 - (components.hour ?? 0)) hours left")
            } else if budget.type == 2 {
                let components = calendar.dateComponents([.day], from: budget.wrappedDate, to: Date.now)

                return String(localized: "\(7 - (components.day ?? 0)) days left")
            } else {
                let components1 = calendar.dateComponents([.day], from: budget.wrappedDate, to: budget.endDate)
                let numberOfDays = components1.day ?? 0

                let components2 = calendar.dateComponents([.day], from: budget.wrappedDate, to: Date.now)
                let numberOfDaysPast = components2.day ?? 0

                let daysLeftNumber = Int(numberOfDays - numberOfDaysPast)
                return String(localized: "\(daysLeftNumber) days left")
            }
        }
    }

    @AppStorage(DefaultsKey.currency, store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency)!
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

    var targetPercent: Double {
        let calendar = Calendar.current

        if budget.isFault {
            return 0.0
        }

        let components1 = calendar.dateComponents([.day], from: budget.wrappedDate, to: budget.endDate)
        let numberOfDays = components1.day ?? 0

        let components2 = calendar.dateComponents([.day], from: budget.wrappedDate, to: Date.now)
        let numberOfDaysPast = components2.day ?? 0 + 1

        return Double(numberOfDays - numberOfDaysPast) / Double(numberOfDays)
    }

    @Environment(\.colorScheme) var colorScheme

    // swipe to delete
    @Environment(\.managedObjectContext) var moc
    @Environment(DataController.self) private var dataController
    @State private var offset: CGFloat = 0
    @State private var deleted: Bool = false

    var deletePopup: Bool {
        return abs(offset) > UIScreen.main.bounds.width * 0.15
    }

    var deleteConfirm: Bool {
        return abs(offset) > UIScreen.main.bounds.width * 0.50
    }

    @GestureState var isDragging = false

    var body: some View {
        Group {
            if budgetRows {
                rowLayout
            } else {
                cardLayout
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
    }

    private var rowLayout: some View {
        ZStack(alignment: .trailing) {
                    Image(systemName: "xmark")
                        .font(.system(.footnote, design: .rounded).weight(.bold))
                        .foregroundStyle(deleteConfirm ? Color.AlertRed : Color.SubtitleText)
                        .padding(5)
                        .background(deleteConfirm ? Color.AlertRed.opacity(0.23) : Color.SecondaryBackground, in: Circle())
                        .scaleEffect(deleteConfirm ? 1.1 : 1)
                        .contentShape(Circle())
                        .opacity(deleted ? 0 : 1)
                        .padding(.horizontal, 10)
                        .offset(x: 80)
                        .offset(x: max(-80, offset))

                    HStack {
                        HStack(spacing: 10) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .fill(.white)

                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .fill(Color(hex: budget.wrappedColor).opacity(0.3))
                            }
                            .frame(width: 40, height: 40)
                            .overlay {
                                CategoryIconGlyph(symbol: budget.displaySymbol, size: 20)
                                    .foregroundStyle(Color(hex: budget.wrappedColor))
                            }

                            VStack(alignment: .leading, spacing: -0.5) {
                                Text(budget.wrappedName)
                                    .font(.system(.body, design: .rounded).weight(.semibold))
                                    .lineLimit(1)
                                    .foregroundStyle(Color.PrimaryText)

                                Text("\(timeLeft) • \(percentString1) spent")
                                    .font(.system(.footnote, design: .rounded).weight(.medium))
                                    .lineLimit(1)
                                    .foregroundStyle(Color.SubtitleText)
                            }
                        }

                        Spacer()

                        VStack(alignment: .trailing, spacing: -4) {
                            BudgetDollarView(amount: difference, red: totalSpent >= budgetAmount, scale: 1, size: 80)

                            Text("\(budgetAmount >= totalSpent ? "left" : "over") \(budgetType)")
                                .font(.system(.caption2, design: .rounded).weight(.medium))
                                .foregroundStyle(Color.SubtitleText)
                        }
                    }
                    .padding(10)
                    .background(colorScheme == .dark ? Color.Outline.opacity(0.2) : Color.Outline.opacity(0.35), in: RoundedRectangle(cornerRadius: 13, style: .continuous))
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
                    .offset(x: offset)
                }
                .padding(.horizontal, 30)
                .onChange(of: deletePopup) { _, _ in
                    if deletePopup {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    }
                }
                .onChange(of: deleteConfirm) { _, _ in
                    if deleteConfirm {
                        UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
                    }
                }
                .animation(.default, value: deletePopup)
                .simultaneousGesture(
                    DragGesture()
                        .updating($isDragging, body: { _, state, _ in
                            state = true
                        })
                        .onChanged { value in
                            if value.translation.width < 0 {
                                offset = value.translation.width
                            }
                        }.onEnded { _ in
                            if deleteConfirm {
                                deleted = true
                                withAnimation(.easeInOut(duration: 0.3)) {
                                    offset -= UIScreen.main.bounds.width
                                }

                                DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                                    withAnimation {
                                        moc.delete(budget)
                                        try? dataController.save()
                                    }
                                }

                            } else if deletePopup {
                                withAnimation(.easeInOut(duration: 0.3)) {
                                    offset = 0
                                }

                                toDelete = budget
                            } else {
                                withAnimation(.easeInOut(duration: 0.3)) {
                                    offset = 0
                                }
                            }
                        }
                )
                .onChange(of: isDragging) { _, _ in
                    if !isDragging && !deleted {
                        withAnimation(.easeInOut(duration: 0.3)) {
                            offset = 0
                        }
                    }
                }
    }

    private var cardLayout: some View {
        VStack {
                    HStack {
                        VStack(alignment: .leading, spacing: 0.5) {
                            HStack(spacing: 4) {
                                CategoryIconGlyph(symbol: budget.displaySymbol, size: 12)
                                    .foregroundStyle(Color(hex: budget.wrappedColor))

                                Text(budget.wrappedName)
                                    .font(.system(.subheadline, design: .rounded).weight(.semibold))
                                    .lineLimit(1)
                                    .foregroundStyle(Color.PrimaryText)
                            }

                            Text(timeLeft)
                                .font(.system(.footnote, design: .rounded).weight(.semibold))
                                .foregroundStyle(Color.SubtitleText)
                                .multilineTextAlignment(.leading)
                        }

                        Spacer()
                    }
                    .frame(maxWidth: .infinity)

                    Spacer(minLength: 30)

                    HStack {
                        VStack(alignment: .leading, spacing: -2) {
                            if totalSpent < budgetAmount {
                                Text("\(percentString1) SPENT")
                                    .font(.system(.caption2, design: .rounded).weight(.semibold))
                                    .lineLimit(1)
                                    .foregroundStyle(totalSpent / budgetAmount > 1 ? Color("BudgetRed") : Color.IncomeGreen)
                                    .padding(.bottom, 5)
                            }

                            BudgetDollarView(amount: difference, red: totalSpent >= budgetAmount, scale: 2, size: width - 40)

                            Text("\(budgetAmount >= totalSpent ? "left" : "over") \(budgetType)")
                                .font(.system(.footnote, design: .rounded).weight(.medium))
                                .foregroundStyle(Color.SubtitleText)
                                .minimumScaleFactor(0.7)
                                .lineLimit(1)
                        }

                        Spacer()
                    }
                    .frame(maxWidth: .infinity)

                    GeometryReader { proxy in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 11.5, style: .continuous)
                                .fill(Color.SubtitleText.opacity(0.15))
                                .frame(width: proxy.size.width)

                            if totalSpent / budgetAmount < 0.98 {
                                if let category = budget.category {
                                    AnimatedHorizontalBarGraphBudget(category: category)
                                        .frame(width: proxy.size.width * (1 - totalSpent / budgetAmount))
                                }
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .overlay(alignment: .topLeading) {
                            if budget.type != 1 && totalSpent < budgetAmount && targetPercent > 0 && targetPercent < 0.95 {
                                RoundedTriangle(cornerRadius: 1.3)
                                    .fill((targetPercent * budgetAmount) <= (budgetAmount - totalSpent) ? Color.DarkBackground : Color.BudgetRed)
                                    .frame(width: 14, height: 6.5)
                                    .offset(x: (targetPercent * proxy.size.width) - 7, y: -3.5)
                            }
                        }
                    }
                    .frame(height: 17.5)
                }
                .padding(15)
                .frame(width: width + 30)
                .background(colorScheme == .dark ? Color.Outline.opacity(0.2) : Color.Outline.opacity(0.35), in: RoundedRectangle(cornerRadius: 13, style: .continuous))
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
    }

    init(budget: Budget, toDelete: Binding<Budget?>?, toEdit: Binding<Budget?>?, budgetRows: Bool) {
        self.budget = budget
        self.budgetRows = budgetRows
        _toDelete = toDelete ?? Binding.constant(nil)
        _toEdit = toEdit ?? Binding.constant(nil)

        let date = budget.startDate ?? Date.now

        let startPredicate = NSPredicate(format: "%K >= %@", #keyPath(Transaction.date), date as CVarArg)
        let endPredicate = NSPredicate(format: "%K <= %@", #keyPath(Transaction.date), Date.now as CVarArg)
        let incomePredicate = NSPredicate(format: "income = %d", false)

        let andPredicate: NSCompoundPredicate

        if let category = budget.category {
            let categoryPredicate = NSPredicate(format: "category == %@ OR category.parent == %@", category, category)
            andPredicate = NSCompoundPredicate(type: .and, subpredicates: [startPredicate, endPredicate, categoryPredicate, incomePredicate])

            _transactions = FetchRequest<Transaction>(sortDescriptors: [], predicate: andPredicate)
        } else {
            andPredicate = NSCompoundPredicate(type: .and, subpredicates: [startPredicate, endPredicate, incomePredicate])

            _transactions = FetchRequest<Transaction>(sortDescriptors: [], predicate: andPredicate)
        }
    }
}
