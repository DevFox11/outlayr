//
//  LogView.swift
//  xpenz
//
//  Created by Rafael Soh on 19/5/22.
//

import CloudKitSyncMonitor
import CoreData
import Foundation
import Popovers
import SwiftUI

struct LogView: View {
    @ObservedObject var syncMonitor = SyncMonitor.shared

    @State var updatedRecurring = false

    @FetchRequest(sortDescriptors: []) private var transactions: FetchedResults<Transaction>

    @Environment(DataController.self) private var dataController
    @Environment(\.managedObjectContext) var moc

    @AppStorage(DefaultsKey.showCents, store: AppIdentifiers.sharedDefaults) var showCents: Bool = true

    var topEdge: CGFloat

    @AppStorage(DefaultsKey.currency, store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency) ?? currency
    }

    @State var addTransaction = false

    // searching
    @State var searchMode = false

    // top bar
    @State var navBarText = ""
    @State var showMenu = false
    @AppStorage(DefaultsKey.logTimeFrame, store: AppIdentifiers.sharedDefaults) var logTimeFrame = 2
    let subtitleText = ["today", "this week", "this month", "this year"]

    // show filter menu
    @State var showFilter = false
    @State var filter = FilterType.all

    // filters
    @State var categoryFilter: Category?
    @State var dateFilter = Date.now
    @State var weekFilter = Date.now
    @State var monthFilter = Date.now
    @State var income = false

    // to show/hide tab bar
    var bottomEdge: CGFloat
    var launchSearch: Bool

    @State var progress = 0.0
    @State private var resetTask: Task<Void, Never>?

    var body: some View {
        if transactions.isEmpty {
            emptyState
        } else {
            populatedLog
        }
    }

    private var emptyState: some View {
        VStack(spacing: 5) {
            Image("dropbox")
                .resizable()
                .frame(width: 75, height: 75)
                .padding(.bottom, 20)
                .accessibility(hidden: true)

            Text("Your Log is Empty")
                .font(.system(.title2, design: .rounded).weight(.medium))
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.PrimaryText.opacity(0.8))

            Text("Press the plus button\nto add your first entry")
                .font(.system(.body, design: .rounded).weight(.medium))
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.SubtitleText)
        }
        .padding(.horizontal, 30)
        .frame(height: 250, alignment: .top)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.PrimaryBackground)
    }

    private var populatedLog: some View {
        VStack(spacing: 0) {
            header

            transactionsScroll
        }
        .background(Color.PrimaryBackground)
        .fullScreenCover(isPresented: $searchMode) {
            SearchView()
        }
        .onChange(of: syncMonitor.syncStateSummary) { _, newState in
            if newState == .succeeded && !updatedRecurring {
                dataController.transactions.updateRecurringTransactions()
                updatedRecurring = true

                resetTask?.cancel()
                resetTask = Task {
                    try? await Task.sleep(for: .seconds(60))
                    updatedRecurring = false
                }
            }
        }
        .task {
            for await _ in NotificationCenter.default.notifications(named: UIApplication.willEnterForegroundNotification) {
                if syncMonitor.syncStateSummary == .succeeded && !updatedRecurring {
                    dataController.transactions.updateRecurringTransactions()
                    updatedRecurring = true

                    resetTask?.cancel()
                    resetTask = Task {
                        try? await Task.sleep(for: .seconds(60))
                        updatedRecurring = false
                    }
                } else if !NSUbiquitousKeyValueStore.default.bool(forKey: "icloud_sync") {
                    dataController.transactions.updateRecurringTransactions()
                }
            }
        }
        .onChange(of: launchSearch) { _, _ in
            searchMode = true
        }
        .onAppear {
            if !NSUbiquitousKeyValueStore.default.bool(forKey: "icloud_sync") {
                dataController.transactions.updateRecurringTransactions()
            }
        }
        .onOpenURL { url in
            guard url.host == "search" else {
                return
            }
            searchMode = true
        }
    }

    private var header: some View {
        VStack(spacing: 18) {
            HStack {
                Button {
                    searchMode = true
                } label: {
                    Image(systemName: "magnifyingglass")
                        .font(.system(.title2, design: .rounded).weight(.regular))
                        .dynamicTypeSize(...DynamicTypeSize.xxLarge)
                        .foregroundStyle(Color.DarkIcon)
                        .padding(5)
                        .contentShape(Rectangle())
                        .background {
                            RoundedRectangle(cornerRadius: 7)
                                .fill(Color.SecondaryBackground)
                                .scaleEffect(progress == 1 ? 1.5 : 1.0)
                                .opacity(progress)
                        }
                }
                .accessibilityLabel("Search")

                Spacer()

                switch filter {
                case .all:
                    EmptyView()
                case .category:
                    filterTagView(text: "filter-tag-category")
                case .day:
                    filterTagView(text: "filter-tag-day")
                case .week:
                    filterTagView(text: "filter-tag-week")
                case .month:
                    filterTagView(text: "filter-tag-month")
                case .recurring:
                    filterTagView(text: "filter-tag-recurring")
                case .type:
                    filterTagView(text: "filter-tag-type")
                case .upcoming:
                    filterTagView(text: "filter-tag-upcoming")
                }

                Spacer()

                Button {
                    showFilter = true
                } label: {
                    Image(systemName: filter == .all ? "triangle" : "triangle.tophalf.filled")
                        .font(.system(.title2, design: .rounded).weight(.regular))
                        .dynamicTypeSize(...DynamicTypeSize.xxLarge)
                        .foregroundStyle(Color.DarkIcon)
                        .rotationEffect(Angle(degrees: 180))
                        .padding(5)
                        .contentShape(Rectangle())
                        .background {
                            if showFilter {
                                RoundedRectangle(cornerRadius: 7)
                                    .fill(Color.SecondaryBackground)
                            }
                        }
                }
                .accessibilityLabel("Filter")
                .popover(present: $showFilter, attributes: {
                    $0.position = .absolute(
                        originAnchor: .bottomRight,
                        popoverAnchor: .topRight
                    )
                    $0.rubberBandingMode = .none
                    $0.sourceFrameInset = UIEdgeInsets(top: 0, left: 0, bottom: -10, right: 0)
                    $0.presentation.animation = .easeInOut(duration: 0.2)
                    $0.dismissal.animation = .easeInOut(duration: 0.3)
                }) {
                    FilterPickerView(filterType: $filter, showMenu: $showFilter)
                }
            }

            switch filter {
            case .all:
                EmptyView()
            case .category:
                CategoryStepperView(categoryFilter: $categoryFilter)
            case .day:
                DateStepperView(date: $dateFilter)
            case .week:
                WeekStepperView(showingDate: $weekFilter)
            case .month:
                MonthStepperView(showingDate: $monthFilter)
            case .recurring:
                EmptyView()
            case .type:
                IncomeFilterToggleView(income: $income)
            case .upcoming:
                EmptyView()
            }
        }
        .padding(.horizontal, 25)
        .frame(height: (filter == .all || filter == .recurring || filter == .upcoming) ? 50 : 110, alignment: .top)
        .padding(.top, topEdge + 10)
    }

    private var transactionsScroll: some View {
        ScrollView(showsIndicators: false) {
            if filter == .all {
                LogInsightsView(navBarText: $navBarText, showCents: showCents, currencySymbol: currencySymbol)
            }

            TransactionsList(filter: filter, category: categoryFilter, date: dateFilter, week: weekFilter, month: monthFilter, income: income)
                .zIndex(0)
                .padding(.horizontal, 20)
                .padding(.bottom, 70 + bottomEdge)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    func filterTagView(text: LocalizedStringKey) -> some View {
        HStack(spacing: 10) {
            Text(text)
                .font(.system(.body, design: .rounded).weight(.medium))
                .dynamicTypeSize(...DynamicTypeSize.xxxLarge)

            Button {
                withAnimation(.easeIn(duration: 0.15)) {
                    filter = .all
                }
            } label: {
                Image(systemName: "xmark")
                    .font(.system(.caption, design: .rounded).weight(.regular))
                    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                    .foregroundStyle(Color.PrimaryText.opacity(0.7))
            }
            .accessibilityLabel("remove filter")
        }
        .padding(4)
        .padding(.horizontal, 6)
        .background(Color.SecondaryBackground, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
        .foregroundStyle(Color.PrimaryText)
    }
}
