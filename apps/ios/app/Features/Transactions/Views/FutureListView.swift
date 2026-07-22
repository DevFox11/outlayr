//
//  FutureListView.swift
//  Outlayr

import CoreData
import Foundation
import SwiftUI

struct FutureListView: View {
    @Environment(DataController.self) private var dataController

    @FetchRequest private var fetchedResults: FetchedResults<Transaction>
    var filterMode: Bool
    var limitedMode: Bool

    var transactions: [Transaction] {
        if limitedMode {
            let calendar = Calendar.current

            let startOfToday = calendar.startOfDay(for: Date.now)
            let twoWeeksFromStartOfToday = calendar.date(byAdding: .weekOfYear, value: 2, to: startOfToday)!

            let holding = fetchedResults.filter {
                let date = $0.wrappedDate > Date.now ? $0.wrappedDate : $0.nextTransactionDate

                return date < twoWeeksFromStartOfToday
            }

            return holding.sorted { itemA, itemB in
                let date1 = itemA.wrappedDate > Date.now ? itemA.wrappedDate : itemA.nextTransactionDate
                let date2 = itemB.wrappedDate > Date.now ? itemB.wrappedDate : itemB.nextTransactionDate

                return date1 > date2
            }

        } else {
            return fetchedResults.sorted { itemA, itemB in
                let date1 = itemA.wrappedDate > Date.now ? itemA.wrappedDate : itemA.nextTransactionDate
                let date2 = itemB.wrappedDate > Date.now ? itemB.wrappedDate : itemB.nextTransactionDate

                return date1 > date2
            }
        }
    }

    @AppStorage(DefaultsKey.showCents, store: AppIdentifiers.sharedDefaults) var showCents: Bool = true

    @AppStorage(DefaultsKey.currency, store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency) ?? currency
    }

    @AppStorage(DefaultsKey.showExpenseOrIncomeSign, store: AppIdentifiers.sharedDefaults)
    var showExpenseOrIncomeSign: Bool = true

    @AppStorage(DefaultsKey.swapTimeLabel, store: AppIdentifiers.sharedDefaults) var swapTimeLabel: Bool = false

    var totals: CurrencyTotals {
        CurrencyTotals(
            globalCurrency: currency,
            entries: transactions.map {
                CurrencyTotals.Entry(currency: $0.wrappedCurrency, amount: $0.income ? $0.amount : -$0.amount)
            }
        )
    }

    var body: some View {
        if !transactions.isEmpty {
            VStack(spacing: 0) {
                VStack(spacing: 5) {
                    HStack(alignment: .firstTextBaseline) {
                        MonoLabel(verbatim: String(localized: "UPCOMING"))
                            .layoutPriority(1)

                        Spacer(minLength: 8)

                        upcomingTotals
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(accessibilityTotal)

                    Line()
                        .stroke(Color.Outline, style: StrokeStyle(lineWidth: 1.3, lineCap: .round))
                }
                .padding(.horizontal, 10)

                ForEach(transactions) { transaction in
                    SingleTransactionView(transaction: transaction, showCents: showCents, currencySymbol: currencySymbol, currency: currency, swapTimeLabel: swapTimeLabel, future: true, showExpenseOrIncomeSign: showExpenseOrIncomeSign)
                }
            }
            .padding(.bottom, 18)
        } else if transactions.isEmpty && filterMode {
            NoResultsView(fullscreen: true)
        } else {
            EmptyView()
        }
    }

    /// Upcoming entries can be denominated in several currencies, so they are
    /// listed side by side rather than added: there is no rate here, and a single
    /// figure would be an invention.
    private var upcomingTotals: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            ForEach(Array(totals.buckets.enumerated()), id: \.element.id) { index, bucket in
                if index > 0 {
                    Text(verbatim: "/")
                        .foregroundStyle(Color.EvenLighterText)
                }

                Text(verbatim: CurrencyAmountFormatter(currencyCode: bucket.currencyCode, showCents: showCents)
                    .signedString(bucket.amount))
                    .monospacedDigit()
            }
        }
        .font(.system(.callout, design: .rounded).weight(.semibold))
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .foregroundStyle(Color.SubtitleText)
    }

    private var accessibilityTotal: String {
        totals.buckets
            .map { CurrencyAmountFormatter(currencyCode: $0.currencyCode, showCents: showCents).signedString($0.amount) }
            .joined(separator: ", ")
    }

    init(dataController _: DataController, filterMode: Bool, limitedMode: Bool) {
        let recurringPredicate = NSPredicate(format: "%K > %i", #keyPath(Transaction.recurringType), 0)
        let futurePredicate = NSPredicate(format: "%K > %@", #keyPath(Transaction.date), Date.now as CVarArg)

        let andPredicate = NSCompoundPredicate(type: .or, subpredicates: [recurringPredicate, futurePredicate])

        _fetchedResults = FetchRequest<Transaction>(sortDescriptors: [], predicate: andPredicate)

        self.filterMode = filterMode
        self.limitedMode = limitedMode
    }
}
