//
//  TransactionsList.swift
//  Outlayr
//

import CloudKitSyncMonitor
import CoreData
import Foundation
import Popovers
import SwiftUI

struct TransactionsList: View {
    var filter: FilterType
    var category: Category?
    var date: Date
    var week: Date
    var month: Date
    var income: Bool

    @AppStorage("showUpcomingTransactions", store: AppIdentifiers.sharedDefaults) var showUpcoming: Bool = true
    @AppStorage("showUpcomingTransactionsWhenUpcoming", store: AppIdentifiers.sharedDefaults) var showSoon: Bool = false

    @Environment(DataController.self) private var dataController

    @SectionedFetchRequest<Date?, Transaction>(sectionIdentifier: \.day, sortDescriptors: [
        SortDescriptor(\.day, order: .reverse),
        SortDescriptor(\.date, order: .reverse),
        SortDescriptor(\.note)
    ], predicate: NSPredicate(format: "%K <= %@", #keyPath(Transaction.date), Date.now as CVarArg)) private var transactions: SectionedFetchResults<Date?, Transaction>

    var body: some View {
        VStack {
            if (filter == .all && showUpcoming) || filter == .upcoming {
                FutureListView(dataController: dataController, filterMode: filter == .upcoming, limitedMode: showSoon)
                    .padding(.top, 10)
            }

            switch filter {
            case .all:
                ListView(transactions: _transactions)
            case .category:
                FilteredCategoryView(category: category)
            case .day:
                FilteredDateView(date: date)
            case .week:
                FilteredInsightsView(startDate: week, type: 1)
            case .month:
                FilteredInsightsView(startDate: month, type: 2)
            case .recurring:
                FilteredRecurringView()
            case .type:
                FilteredTypeView(income: income)
            case .upcoming:
                EmptyView()
            }
        }
    }
}

struct ListView: View {
    @SectionedFetchRequest<Date?, Transaction> var transactions: SectionedFetchResults<Date?, Transaction>

    @AppStorage("showCents", store: AppIdentifiers.sharedDefaults) var showCents: Bool = true

    @AppStorage("currency", store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currencyCode!
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency)!
    }
    
    @AppStorage("showExpenseOrIncomeSign", store: AppIdentifiers.sharedDefaults)
    var showExpenseOrIncomeSign: Bool = true

    @AppStorage("swapTimeLabel", store: AppIdentifiers.sharedDefaults) var swapTimeLabel: Bool = false

    @Environment(OverallToastPresenter.self) private var toastPresenter

    var body: some View {
        LazyVStack(spacing: 0) {
            ForEach(transactions) { day in
                let filtered = filterOutDupes(day: day)
                let dateText = dateConverter(date: day.id ?? Date.now).uppercased()

                VStack(spacing: 0) {
                    VStack(spacing: 4) {
                        HStack {
                            Text(dateText)
                            Spacer()

                            Text(filtered.string)
                                .layoutPriority(1)
                        }
                        .font(.system(.callout, design: .rounded).weight(.semibold))
                        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                        .foregroundStyle(Color.SubtitleText)
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("\(currencySymbol)\(String(format: "%.2f", filtered.string)) was spent \(dateConverterAccessibilityLabel(date: day.id ?? Date.now))")

                        Line()
                            .stroke(Color.Outline, style: StrokeStyle(lineWidth: 1.3, lineCap: .round))
                    }
                    .padding(.horizontal, 10)
                    .padding(.top, 10)

                    ForEach(filtered.transactions, id: \.id) { transaction in
                        SingleTransactionView(transaction: transaction, showCents: showCents, currencySymbol: currencySymbol, currency: currency, swapTimeLabel: swapTimeLabel, future: false, showExpenseOrIncomeSign: showExpenseOrIncomeSign)
                    }
                }
                .contentShape(RoundedRectangle(cornerRadius: 10))
                .contextMenu {
                    if #available(iOS 16.0, *) {
                        Button {
                            guard let image = ImageRenderer(content: SingleDayPhotoView(amountText: filtered.string, dateText: dateText, transactions: filtered.transactions, showCents: showCents, currencySymbol: currencySymbol, currency: currency, swapTimeLabel: swapTimeLabel, future: false)).uiImage else {
                                return
                            }

                            UIImageWriteToSavedPhotosAlbum(image, nil, nil, nil)

                            self.toastPresenter.showToast.toggle()
                        } label: {
                            Label("Save as Photo", systemImage: "square.and.arrow.up")
                        }
                    }
                }
                .padding(.bottom, 18)
            }
        }
    }

    func filterOutDupes(day: SectionedFetchResults<Date?, Transaction>.Element) -> (transactions: [Transaction], string: String) {
        var seen = [Transaction]()
        let filtered = day.filter { entity -> Bool in
            if seen.contains(where: { $0.id == entity.id }) {
                return false
            } else {
                seen.append(entity)
                return true
            }
        }

        let numberFormatter = NumberFormatter()
        numberFormatter.numberStyle = .currency
        numberFormatter.currencyCode = currency

        if showCents {
            numberFormatter.maximumFractionDigits = 2
        } else {
            numberFormatter.maximumFractionDigits = 0
        }

        let total = dayTotal(dayTransaction: filtered)

        let text: String

        if total >= 0 {
            text = "+" + (numberFormatter.string(from: NSNumber(value: total)) ?? "$0")
        } else {
            text = (numberFormatter.string(from: NSNumber(value: total)) ?? "$0")
        }

        return (filtered, text)
    }
}

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

    @AppStorage("showCents", store: AppIdentifiers.sharedDefaults) var showCents: Bool = true

    @AppStorage("currency", store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currencyCode!
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency)!
    }
    
    @AppStorage("showExpenseOrIncomeSign", store: AppIdentifiers.sharedDefaults)
    var showExpenseOrIncomeSign: Bool = true

    @AppStorage("swapTimeLabel", store: AppIdentifiers.sharedDefaults) var swapTimeLabel: Bool = false

    var totalString: String {
        let numberFormatter = NumberFormatter()
        numberFormatter.numberStyle = .currency
        numberFormatter.currencyCode = currency

        if showCents {
            numberFormatter.maximumFractionDigits = 2
        } else {
            numberFormatter.maximumFractionDigits = 0
        }

        var total = 0.0

        transactions.forEach { transaction in
            if transaction.income {
                total += transaction.amount
            } else {
                total -= transaction.amount
            }
        }

        if total >= 0 {
            return "+" + (numberFormatter.string(from: NSNumber(value: total)) ?? "$0")
        } else {
            return numberFormatter.string(from: NSNumber(value: total)) ?? "$0"
        }
    }

    var body: some View {
        if !transactions.isEmpty {
            VStack(spacing: 0) {
                VStack(spacing: 4) {
                    HStack {
                        Text("UPCOMING")
                        Spacer()

                        Text(totalString)
                    }
                    .font(.system(.callout, design: .rounded).weight(.semibold))
                    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.SubtitleText)
                    .accessibilityElement(children: .ignore)

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

    init(dataController _: DataController, filterMode: Bool, limitedMode: Bool) {
        let recurringPredicate = NSPredicate(format: "%K > %i", #keyPath(Transaction.recurringType), 0)
        let futurePredicate = NSPredicate(format: "%K > %@", #keyPath(Transaction.date), Date.now as CVarArg)

        let andPredicate = NSCompoundPredicate(type: .or, subpredicates: [recurringPredicate, futurePredicate])

        _fetchedResults = FetchRequest<Transaction>(sortDescriptors: [], predicate: andPredicate)

        self.filterMode = filterMode
        self.limitedMode = limitedMode
    }
}
