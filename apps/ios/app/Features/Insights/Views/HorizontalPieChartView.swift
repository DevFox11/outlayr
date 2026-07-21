//
//  InsightsView.swift
//  xpenz
//
//  Created by Rafael Soh on 20/5/22.
//

import Foundation
import Popovers
import CoreData
import SwiftUI

private struct BreakdownEntry: Identifiable {
    let id: String
    let symbol: CategorySymbol
    let name: String
    let amount: Double
}

struct HorizontalPieChartView: View {
    @FetchRequest private var allCategories: FetchedResults<Category>
    @FetchRequest private var transactions: FetchedResults<Transaction>

    @AppStorage("currency", store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency)!
    }

    @AppStorage("showCents", store: AppIdentifiers.sharedDefaults) var showCents: Bool = true

    var income: Bool
    var date: Date
    var total: Double {
        var holdingTotal = 0.0

        transactions.forEach { transaction in
            holdingTotal += transaction.amount
        }

        return holdingTotal
    }

    @Binding var chosenAmount: Double
    @Binding var chosenName: String

    @Binding var categoryFilterMode: Bool
    @Binding var categoryFilter: Category?
    @Binding var selectedDate: Date?

    @Environment(\.dynamicTypeSize) var dynamicTypeSize

    var fontSize: CGFloat {
        switch dynamicTypeSize {
        case .xSmall:
            return 12
        case .small:
            return 13
        case .medium:
            return 14
        case .large:
            return 15
        case .xLarge:
            return 17
        case .xxLarge:
            return 19
        case .xxxLarge:
            return 21
        default:
            return 15
        }
    }

    var percentWidth: CGFloat {
        return "100%".widthOfRoundedString(size: fontSize, weight: .medium) + 4
    }

    var categories: [PowerCategory] {
        var holding = [PowerCategory]()

        for category in allCategories {
            var holdingTotal = 0.0

            transactions.forEach { transaction in
                if transaction.category == category || transaction.category?.parent == category {
                    holdingTotal += transaction.wrappedAmount
                }
            }

            if holdingTotal == 0 {
                continue
            }

            let newCategory = PowerCategory(id: category.id ?? UUID(), category: category, percent: holdingTotal / total, amount: holdingTotal)

            holding.append(newCategory)
        }

        holding.sort(by: { lhs, rhs in
            lhs.percent > rhs.percent
        })

        return holding
    }

    var body: some View {
        if !categories.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                barGraphSection

                categoryListSection
            }
            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        }
    }

    @ViewBuilder private var barGraphSection: some View {
        if !categoryFilterMode {
            Text("Categories")
                .font(.system(.callout, design: .rounded).weight(.semibold))
                .foregroundStyle(Color.SubtitleText)

            GeometryReader { proxy in
                HStack(spacing: proxy.size.width * 0.015) {
                    ForEach(categories) { category in
                        if category.percent < 0.005 {
                            EmptyView()
                        } else {
                            AnimatedHorizontalBarGraph(category: category, index: categories.firstIndex(of: category) ?? 0)
                                .frame(width: (proxy.size.width * (1.0 - (0.015 * Double(categories.count - 1)))) * category.percent)
                                .onTapGesture {
                                    withAnimation(.easeInOut) {
                                        if categoryFilter == category.category {
                                            selectedDate = nil
                                            categoryFilterMode = false
                                            categoryFilter = nil
                                        } else {
                                            selectedDate = nil
                                            categoryFilterMode = true
                                            categoryFilter = category.category
                                            chosenAmount = category.percent * total
                                            chosenName = category.category.wrappedName
                                        }
                                    }
                                }
                                .opacity(categoryFilterMode ? (categoryFilter == category.category ? 1 : 0.5) : 1)
                                .overlay {
                                    if categoryFilterMode && categoryFilter == category.category {
                                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                                            .stroke(Color.DarkBackground, lineWidth: 1.5)
                                    }
                                }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(height: 17)
            .padding(.bottom, 10)
        }
    }

    private var categoryListSection: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 10) {
                ForEach(categories, id: \.self) { category in
                    if !categoryFilterMode || categoryFilter == category.category {
                        let boxColor = category.category.income ? Color(hex: Color.colorArray[categories.firstIndex(of: category) ?? 0]) : Color(hex: category.category.wrappedColour)

                        HStack(spacing: 10) {

                            HStack(spacing: 8) {
                                CategoryIconGlyph(symbol: category.category.displaySymbol, size: 20)
                                    .foregroundStyle(boxColor)

                                Text(category.category.wrappedName)
                                    .font(.system(.title3, design: .rounded).weight(.semibold))
                                    .foregroundStyle(Color.PrimaryText)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)

                            Text("\(currencySymbol)\(category.amount, specifier: (showCents && category.amount < 100) ? "%.2f" : "%.0f")")
                                .font(.system(categoryFilterMode && categoryFilter == category.category ? .title3 : .body, design: .rounded).weight(.medium))
                                .foregroundStyle(Color.SubtitleText)
                                .lineLimit(1)
                                .layoutPriority(1)

                            if categoryFilterMode && categoryFilter == category.category {
                                Button {
                                    withAnimation(.easeInOut) {
                                        selectedDate = nil
                                        categoryFilterMode = false
                                        categoryFilter = nil
                                    }
                                } label: {
                                    Image(systemName: "xmark")
                                        .font(.system(.footnote, design: .rounded).weight(.bold))
                                        .foregroundStyle(Color.SubtitleText)
                                        .padding(5)
                                        .background(Color.SecondaryBackground, in: Circle())
                                }

                            } else {

                                Text("\(category.percent * 100, specifier: "%.0f")%")
                                    .font(.system(.subheadline, design: .rounded).weight(.semibold))
                                    .foregroundStyle(boxColor)
                                    .padding(.vertical, 3)
                                    .frame(width: percentWidth)
                                    .background(boxColor.opacity(0.23), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                            }
                        }
                        .padding(.vertical, categoryFilterMode && categoryFilter == category.category ? 10 : 5)
                        .padding(.horizontal, categoryFilterMode && categoryFilter == category.category ? 10 : 0)
                        .background(RoundedRectangle(cornerRadius: 12).fill(categoryFilterMode && categoryFilter == category.category ? Color.TertiaryBackground : Color.PrimaryBackground))
                        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(categoryFilterMode && categoryFilter == category.category ? Color.Outline : Color.clear, lineWidth: 1.3))
                        .fixedSize(horizontal: false, vertical: true)
                        .contentShape(Rectangle())
                        .drawingGroup()
                        .onTapGesture {
                            withAnimation(.easeInOut) {
                                if !categoryFilterMode {
                                    selectedDate = nil
                                    categoryFilterMode = true
                                    categoryFilter = category.category
                                    chosenAmount = category.percent * total
                                    chosenName = category.category.wrappedName
                                }
                            }
                        }

                        if categoryFilterMode, categoryFilter == category.category, category.category.hasChildren {
                            childrenBreakdown(for: category.category, parentTotal: category.amount, accent: boxColor)
                        }
                    }

                }
            }
        }
    }

    private func childrenBreakdown(for parent: Category, parentTotal: Double, accent: Color) -> some View {
        var entries: [BreakdownEntry] = []

        let directAmount = transactions
            .filter { $0.category == parent }
            .reduce(0) { $0 + $1.wrappedAmount }
        if directAmount > 0 {
            entries.append(BreakdownEntry(
                id: parent.objectID.uriRepresentation().absoluteString + "-direct",
                symbol: parent.displaySymbol, name: "Direct", amount: directAmount
            ))
        }

        for child in parent.sortedChildren {
            let amount = transactions
                .filter { $0.category == child }
                .reduce(0) { $0 + $1.wrappedAmount }
            if amount > 0 {
                entries.append(BreakdownEntry(
                    id: child.objectID.uriRepresentation().absoluteString,
                    symbol: child.displaySymbol, name: child.wrappedName, amount: amount
                ))
            }
        }

        entries.sort { $0.amount > $1.amount }

        return VStack(spacing: 8) {
            ForEach(entries) { entry in
                HStack(spacing: 10) {
                    CategoryIconGlyph(symbol: entry.symbol)
                        .foregroundStyle(accent)
                    Text(entry.name)
                        .font(.system(.subheadline, design: .rounded, weight: .medium))
                        .foregroundStyle(Color.PrimaryText)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text("\(currencySymbol)\(entry.amount, specifier: (showCents && entry.amount < 100) ? "%.2f" : "%.0f")")
                        .font(.system(.subheadline, design: .rounded, weight: .medium))
                        .foregroundStyle(Color.SubtitleText)
                        .lineLimit(1)
                    Text("\(parentTotal > 0 ? entry.amount / parentTotal * 100 : 0, specifier: "%.0f")%")
                        .font(.system(.caption, design: .rounded, weight: .semibold))
                        .foregroundStyle(accent)
                        .frame(width: percentWidth)
                        .padding(.vertical, 3)
                        .background(accent.opacity(0.23), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                }
            }
        }
        .padding(.horizontal, 10)
        .padding(.bottom, 6)
    }

    init(date: Date, categoryFilter: Binding<Category?>?, categoryFilterMode: Binding<Bool>, selectedDate: Binding<Date?>?, chosenAmount: Binding<Double>, chosenName: Binding<String>, type: ChartTimeFrame, income: Bool) {
        self.date = date
        self.income = income
        _categoryFilter = categoryFilter ?? Binding.constant(nil)
        _categoryFilterMode = categoryFilterMode
        _selectedDate = selectedDate ?? Binding.constant(nil)
        _chosenName = chosenName
        _chosenAmount = chosenAmount

        // fetching categories

        _allCategories = FetchRequest<Category>(sortDescriptors: [], predicate: NSPredicate(format: "income = %d AND parent == nil", income))

        // fetching transactions

        let startPredicate = NSPredicate(format: "%K >= %@", #keyPath(Transaction.date), date as CVarArg)
        let incomePredicate = NSPredicate(format: "income = %d", income)

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
            let next = calendar.date(byAdding: .month, value: 1, to: date) ?? Date.now

            if next > Date.now {
                endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), Date.now as CVarArg)
            } else {
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

        let andPredicate = NSCompoundPredicate(type: .and, subpredicates: [startPredicate, endPredicate, incomePredicate])

        _transactions = FetchRequest<Transaction>(sortDescriptors: [], predicate: andPredicate)
    }
}
