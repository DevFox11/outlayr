//
//  LogView.swift
//  xpenz
//
//  Created by Rafael Soh on 19/5/22.
//

import CoreData
import Foundation
import SwiftUI

struct LogView: View {
    @State var updatedRecurring = false

    @FetchRequest(sortDescriptors: []) private var transactions: FetchedResults<Transaction>

    @Environment(DataController.self) private var dataController

    @AppStorage(DefaultsKey.showCents, store: AppIdentifiers.sharedDefaults) var showCents: Bool = true

    var topEdge: CGFloat

    @AppStorage(DefaultsKey.logInsightsTimeFrame, store: AppIdentifiers.sharedDefaults) private var timeframe = 2

    @State private var showingSearch = false

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

    @State private var resetTask: Task<Void, Never>?

    var body: some View {
        NavigationStack {
            Group {
                if transactions.isEmpty {
                    LogEmptyStateView(bottomEdge: bottomEdge)
                        .navigationTitle("Log")
                        .navigationBarTitleDisplayMode(.large)
                } else {
                    log
                        .navigationTitle("Log")
                        .navigationBarTitleDisplayMode(.large)
                        .navigationSubtitleIfAvailable(subtitle)
                        .toolbar {
                            searchButton
                            periodMenu
                            filterMenu
                        }
                }
            }
            .background(Color.PrimaryBackground)
            .navigationDestination(isPresented: $showingSearch) {
                SearchView(bottomEdge: bottomEdge)
            }
        }
        .task {
            for await _ in NotificationCenter.default.notifications(named: UIApplication.willEnterForegroundNotification) {
                if !updatedRecurring {
                    dataController.transactions.updateRecurringTransactions()
                    updatedRecurring = true

                    resetTask?.cancel()
                    resetTask = Task {
                        try? await Task.sleep(for: .seconds(60))
                        updatedRecurring = false
                    }
                }
            }
        }
        .onChange(of: launchSearch) { _, _ in
            showingSearch = true
        }
        .onAppear {
            dataController.transactions.updateRecurringTransactions()
        }
        .onOpenURL { url in
            guard url.host == "search" else {
                return
            }
            showingSearch = true
        }
    }

    @ViewBuilder
    private var log: some View {
        ScrollView(showsIndicators: false) {
            if filter == .all {
                LogInsightsView(showCents: showCents)
            } else {
                LogFilterChipRow(
                    filter: filter,
                    detail: filterDetail,
                    categoryFilter: $categoryFilter,
                    cursor: cursorBinding,
                    income: $income
                ) {
                    withAnimation(.easeIn(duration: 0.15)) {
                        filter = .all
                    }
                }
            }

            // The period filters fetch on an exact day, or on a week's or
            // month's first instant, so the cursor is normalized here rather
            // than trusted: an un-normalized one returns an empty screen.
            TransactionsList(
                filter: filter,
                category: categoryFilter,
                date: normalized(dateFilter, as: .day),
                week: normalized(weekFilter, as: .week),
                month: normalized(monthFilter, as: .month),
                income: income
            )
            // The rows and day headers carry their own 10pt inset as part of
            // their tap target, so this is 10 rather than the hero's 20: both
            // end up 20 from the screen edge.
            .padding(.horizontal, 10)
            .padding(.top, 6)
            .padding(.bottom, 70 + bottomEdge)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ToolbarContentBuilder
    private var searchButton: some ToolbarContent {
        ToolbarItem(placement: .topBarLeading) {
            Button {
                showingSearch = true
            } label: {
                ToolbarIcon("search-01")
            }
            .accessibilityLabel(String(localized: "accessibility.search"))
        }
    }

    /// Which period the figures cover. Kept apart from the filter: they answer
    /// different questions, and one menu holding both scrolled past the fold.
    private var periodMenu: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Menu {
                Picker(selection: $timeframe) {
                    ForEach(LogPeriod.allCases) { option in
                        Text(LocalizedStringKey(option.titleKey)).tag(option.rawValue)
                    }
                } label: {
                    Text("Period")
                }
                .pickerStyle(.inline)
            } label: {
                ToolbarIcon("calendar-01")
            }
            .accessibilityLabel(String(localized: "accessibility.period"))
        }
    }

    /// Which entries are listed. Solid glyph while a filter is on, so the
    /// toolbar says so without the chip row having to be on screen.
    private var filterMenu: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Menu {
                Picker(selection: $filter) {
                    ForEach(FilterType.allCases, id: \.self) { option in
                        Label(
                            LocalizedStringKey(option.rawValue),
                            systemImage: FilterType.imageDictionary[option] ?? "line.3.horizontal.decrease"
                        )
                        .tag(option)
                    }
                } label: {
                    Text("Show")
                }
                .pickerStyle(.inline)
            } label: {
                ToolbarIcon("filter-horizontal", style: filter == .all ? .strokeRounded : .solidRounded)
            }
            .accessibilityLabel(String(localized: "accessibility.filter"))
        }
    }

    /// The one line of context under the title. Composed from the same detail
    /// string the chip shows, so the two can never drift apart.
    private var subtitle: String {
        let periodKey = LogPeriod(storedValue: timeframe).titleKey

        return LogSubtitle(
            filter: filter,
            period: String(localized: String.LocalizationValue(stringLiteral: periodKey)),
            detail: filterDetail
        ).text
    }

    private var filterDetail: String? {
        if let unit = filter.periodUnit {
            let calendar = LogPeriodCursor.appCalendar
            return LogPeriodCursor(unit: unit, containing: cursorBinding.wrappedValue, calendar: calendar)
                .label(calendar: calendar, locale: .current)
        }

        switch filter {
        case .category:
            // The chip loads categories asynchronously; until one is picked the
            // filter still has to name itself rather than render blank.
            return categoryFilter?.wrappedName ?? String(localized: "filter-tag-category")
        case .type:
            return income ? String(localized: "filter-picker-income") : String(localized: "Expense")
        case .recurring:
            return String(localized: "filter-tag-recurring")
        case .upcoming:
            return String(localized: "filter-tag-upcoming")
        case .all, .day, .week, .month:
            return nil
        }
    }

    private func normalized(_ date: Date, as unit: LogPeriodCursor.Unit) -> Date {
        LogPeriodCursor(unit: unit, containing: date, calendar: LogPeriodCursor.appCalendar).date
    }

    /// Routes the chip's stepper at whichever of the three period filters is
    /// active, so switching between them keeps each one where it was left.
    private var cursorBinding: Binding<Date> {
        switch filter {
        case .week: $weekFilter
        case .month: $monthFilter
        default: $dateFilter
        }
    }
}
