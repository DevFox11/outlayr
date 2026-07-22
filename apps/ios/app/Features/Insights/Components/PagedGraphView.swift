//
//  PagedGraphView.swift
//  Outlayr

import Foundation
import CoreData
import SwiftUI

struct PagedGraphView: View {
    let unit: ChartTimeFrame

    @FetchRequest(sortDescriptors: [
        SortDescriptor(\.day)
    ]) private var transactions: FetchedResults<Transaction>

    @AppStorage(DefaultsKey.currency, store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency)!
    }

    @AppStorage(DefaultsKey.showCents, store: AppIdentifiers.sharedDefaults) var showCents: Bool = true
    @AppStorage(DefaultsKey.firstDayOfMonth, store: AppIdentifiers.sharedDefaults) var firstDayOfMonth: Int = 1

    @State var categoryFilterMode = false
    @State var categoryFilter: Category?
    @State var selectedDate: Date?

    @State private var screenWidth: CGFloat = 0
    @State private var offset: CGFloat = 0
    @State private var changeDate: Bool = false
    @GestureState var isDragging = false

    @State var showingDate = Date.now
    @State private var refreshID1 = UUID()

    @State var chosenCategoryName = ""
    @State var chosenCategoryAmount = 0.0

    @AppStorage(DefaultsKey.insightsViewIncomeFiltering, store: AppIdentifiers.sharedDefaults) var income: Bool = true
    @AppStorage(DefaultsKey.incomeTracking, store: AppIdentifiers.sharedDefaults) var incomeTracking: Bool = true
    @State var incomeFiltering: Bool = true

    // MARK: - Unit-specific configuration

    private var graphType: Int {
        switch unit {
        case .week: return 1
        case .month: return 2
        case .year: return 3
        }
    }

    private var calendarComponent: Calendar.Component {
        switch unit {
        case .week: return .day
        case .month: return .month
        case .year: return .year
        }
    }

    // Week advances by 7 days, others by 1 unit
    private var stepValue: Int {
        unit == .week ? 7 : 1
    }

    private var dateFormat: String {
        switch unit {
        case .week: return "d MMM"
        case .month: return "MMM yy"
        case .year: return "yyyy"
        }
    }

    var startOfCurrent: Date {
        switch unit {
        case .week:
            var calendar = Calendar(identifier: .gregorian)
            calendar.firstWeekday = AppIdentifiers.sharedDefaults?.integer(forKey: "firstWeekday") ?? 0
            calendar.minimumDaysInFirstWeek = 4
            let components = calendar.dateComponents([.weekOfYear, .yearForWeekOfYear], from: Date.now)
            return calendar.date(from: components) ?? Date.now
        case .month:
            return getStartOfMonth(startDay: firstDayOfMonth)
        case .year:
            let calendar = Calendar(identifier: .gregorian)
            let components = calendar.dateComponents([.year], from: Date.now)
            return calendar.date(from: components) ?? Date.now
        }
    }

    var startOfEarliest: Date {
        guard !transactions.isEmpty, let day = transactions[0].day else { return Date.now }
        switch unit {
        case .week:
            var calendar = Calendar(identifier: .gregorian)
            calendar.firstWeekday = AppIdentifiers.sharedDefaults?.integer(forKey: "firstWeekday") ?? 0
            calendar.minimumDaysInFirstWeek = 4
            let components = calendar.dateComponents([.weekOfYear, .yearForWeekOfYear], from: day)
            return calendar.date(from: components) ?? Date.now
        case .month:
            return calculateStartOfMonthPeriod(earliestDate: day, startOfMonthDay: firstDayOfMonth)
        case .year:
            let calendar = Calendar(identifier: .gregorian)
            let components = calendar.dateComponents([.year], from: day)
            return calendar.date(from: components) ?? Date.now
        }
    }

    var swipeStrings: (backward: String, forward: String) {
        let formatter = DateFormatter()
        formatter.dateFormat = dateFormat
        let calendar = Calendar.current
        let prev = calendar.date(byAdding: calendarComponent, value: -stepValue, to: showingDate) ?? Date.now
        let next = calendar.date(byAdding: calendarComponent, value: stepValue, to: showingDate) ?? Date.now
        return (formatter.string(from: prev), formatter.string(from: next))
    }

    var changeTime: Bool {
        if offset < -(screenWidth * 0.25) && showingDate != startOfCurrent {
            return true
        } else if offset > (screenWidth * 0.25) && showingDate != startOfEarliest {
            return true
        } else {
            return false
        }
    }

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 18) {
                ZStack {
                    SingleGraphView(showingDate: showingDate, date: $selectedDate, mode: $categoryFilterMode, categoryName: chosenCategoryName, categoryAmount: chosenCategoryAmount, currencySymbol: currencySymbol, showCents: showCents, income: $income, incomeFiltering: $incomeFiltering, type: graphType)
                        .drawingGroup()
                        .onAppear {
                            showingDate = startOfCurrent
                        }
                        .offset(x: offset)

                    if !changeDate {
                        HStack {
                            if showingDate != startOfEarliest {
                                SwipeArrowView(left: true, swipeString: swipeStrings.backward.uppercased(), changeTime: changeTime)
                                    .offset(x: -100)
                                    .offset(x: min(100, offset))
                            } else {
                                SwipeEndView(left: true)
                                    .offset(x: -120)
                                    .offset(x: min(120, offset))
                            }
                            Spacer()
                        }

                        HStack {
                            Spacer()
                            if showingDate != startOfCurrent {
                                SwipeArrowView(left: false, swipeString: swipeStrings.forward.uppercased(), changeTime: changeTime)
                                    .offset(x: 100)
                                    .offset(x: max(-100, offset))
                            } else {
                                SwipeEndView(left: false)
                                    .offset(x: 120)
                                    .offset(x: max(-120, offset))
                            }
                        }
                    }
                }
                .contentShape(Rectangle())
                .padding(.horizontal, 30)
                .simultaneousGesture(
                    DragGesture()
                        .updating($isDragging) { _, state, _ in state = true }
                        .onChanged { value in
                            withAnimation {
                                if value.translation.width < 0, showingDate != startOfCurrent {
                                    offset = value.translation.width * 0.9
                                } else if value.translation.width < 0, showingDate == startOfCurrent {
                                    offset = value.translation.width * 0.5
                                } else if value.translation.width > 0, showingDate != startOfEarliest {
                                    offset = value.translation.width * 0.9
                                } else if value.translation.width > 0, showingDate == startOfEarliest {
                                    offset = value.translation.width * 0.5
                                }
                            }
                        }
                        .onEnded { _ in
                            if changeTime {
                                if offset < 0, showingDate != startOfCurrent {
                                    changeDate = true
                                    offset = screenWidth
                                    showingDate = Calendar.current.date(byAdding: calendarComponent, value: stepValue, to: showingDate) ?? Date.now
                                    withAnimation(.easeInOut(duration: 0.3)) { offset = 0 }
                                } else if offset > 0, showingDate != startOfEarliest {
                                    changeDate = true
                                    offset = -screenWidth
                                    showingDate = Calendar.current.date(byAdding: calendarComponent, value: -stepValue, to: showingDate) ?? Date.now
                                    withAnimation(.easeInOut(duration: 0.3)) { offset = 0 }
                                }
                                withAnimation(.easeInOut(duration: 0.3)) { offset = 0 }
                                changeDate = false
                            }
                        }
                )
                .onChange(of: changeTime) { _, _ in
                    if changeTime { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
                }
                .onChange(of: isDragging) { _, _ in
                    if !isDragging && !changeDate {
                        withAnimation(.easeInOut(duration: 0.3)) { offset = 0 }
                    }
                }
                .animation(.easeInOut, value: changeTime)
                .onChange(of: showingDate) { _, _ in
                    selectedDate = nil
                    categoryFilterMode = false
                    refreshID1 = UUID()
                }
                .onChange(of: income) { _, _ in
                    selectedDate = nil
                    categoryFilterMode = false
                }
                .onChange(of: incomeFiltering) { _, _ in
                    selectedDate = nil
                    categoryFilterMode = false
                }
                .padding(.bottom, incomeFiltering ? 5 : (unit == .week ? 10 : 20))

                Group {
                    if !incomeFiltering {
                        FilteredInsightsView(startDate: showingDate, type: graphType)
                            .padding(.bottom, 70)
                            .padding(.horizontal, 20)
                    } else {
                        if selectedDate == nil {
                            HorizontalPieChartView(date: showingDate, categoryFilter: $categoryFilter, categoryFilterMode: $categoryFilterMode, selectedDate: $selectedDate, chosenAmount: $chosenCategoryAmount, chosenName: $chosenCategoryName, type: unit, income: income)
                                .padding(.horizontal, 30)
                                .padding(.bottom, 70)
                                .id(refreshID1)

                            if categoryFilterMode {
                                FilteredCategoryInsightsView(category: categoryFilter, date: showingDate, type: unit)
                                    .padding(.bottom, 70)
                                    .padding(.horizontal, 20)
                            }
                        } else {
                            selectedDateContent
                                .padding(.bottom, 70)
                                .padding(.horizontal, 20)
                        }
                    }
                }
                .onTapGesture {
                    selectedDate = nil
                    categoryFilterMode = false
                }
            }
        }
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { screenWidth = $0 }
    }

    // Year shows a monthly breakdown of the selected date; week/month show the day's transactions.
    @ViewBuilder
    private var selectedDateContent: some View {
        if unit == .year {
            FilteredInsightsView(startDate: selectedDate ?? Date.now, income: income, type: 2)
        } else {
            FilteredDateInsightsView(date: selectedDate ?? Date.now, income: income)
        }
    }
}
