//
//  MonthGraphView.swift
//  Outlayr
//

import Foundation
import Popovers
import CoreData
import SwiftUI

struct MonthGraphView: View {
    @Environment(DataController.self) private var dataController
    private var didSave = NotificationCenter.default.publisher(for: .NSManagedObjectContextDidSave)
    @State private var refreshID = UUID()

    @FetchRequest(sortDescriptors: [
        SortDescriptor(\.day)
    ]) private var transactions: FetchedResults<Transaction>

    @AppStorage("firstDayOfMonth", store: AppIdentifiers.sharedDefaults) var firstDayOfMonth: Int = 1

    @AppStorage("currency", store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency)!
    }

    @AppStorage("showCents", store: AppIdentifiers.sharedDefaults) var showCents: Bool = true

    @State var categoryFilterMode = false
    @State var categoryFilter: Category?

    @State var selectedDate: Date?

    var startOfCurrentMonth: Date {
        return getStartOfMonth(startDay: firstDayOfMonth)
//        let calendar = Calendar(identifier: .gregorian)
//
//        let dateComponents = calendar.dateComponents([.month, .year], from: Date.now)
//
//        return  calendar.date(from: dateComponents) ?? Date.now
    }

    // start of month of the earliest transaction
    var startOfLastMonth: Date {
        if transactions.isEmpty {
            return Date.now
        } else {
            let date = transactions[0].day ?? Date.now

            return calculateStartOfMonthPeriod(earliestDate: date, startOfMonthDay: firstDayOfMonth)
//
//            let dateComponents = calendar.dateComponents([.month, .year], from: date)
//
//            return  calendar.date(from: dateComponents) ?? Date.now
        }
    }

    var swipeStrings: (backward: String, forward: String) {
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "MMM yy"

        let calendar = Calendar.current

        let startOfLastMonth = calendar.date(byAdding: .month, value: -1, to: showingMonth) ?? Date.now
        let startOfNextMonth = calendar.date(byAdding: .month, value: 1, to: showingMonth) ?? Date.now

        return (dateFormatter.string(from: startOfLastMonth), dateFormatter.string(from: startOfNextMonth))
    }

    @State private var offset: CGFloat = 0
    @State private var changeDate: Bool = false
    @GestureState var isDragging = false
    var changeTime: Bool {
        if offset < -(UIScreen.main.bounds.width * 0.25) && showingMonth != startOfCurrentMonth {
            return true
        } else if offset > (UIScreen.main.bounds.width * 0.25) && showingMonth != startOfLastMonth {
            return true
        } else {
            return false
        }
//
//        return abs(offset) > UIScreen.main.bounds.width * 0.3
    }

    @State var showingMonth = Date.now

    @State private var refreshID1 = UUID()

    @State var chosenCategoryName = ""
    @State var chosenCategoryAmount = 0.0

    @AppStorage("insightsViewIncomeFiltering", store: AppIdentifiers.sharedDefaults) var income: Bool = true
    @AppStorage("incomeTracking", store: AppIdentifiers.sharedDefaults) var incomeTracking: Bool = true

//    @Environment(\.dynamicTypeMultiplier) var multiplier

    @State var incomeFiltering: Bool = true

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 18) {
                ZStack {
                    SingleGraphView(showingDate: showingMonth, date: $selectedDate, mode: $categoryFilterMode, categoryName: chosenCategoryName, categoryAmount: chosenCategoryAmount, currencySymbol: currencySymbol, showCents: showCents, dataController: dataController, income: $income, incomeFiltering: $incomeFiltering, type: 2)
                        .drawingGroup()
                        .id(refreshID)
                        .onAppear {
                            showingMonth = startOfCurrentMonth
                        }
                        .offset(x: offset)

                    if !changeDate {
                        HStack {
                            if showingMonth != startOfLastMonth {
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

                            if showingMonth != startOfCurrentMonth {
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
                        .updating($isDragging, body: { _, state, _ in
                            state = true
                        })
                        .onChanged { value in
                            withAnimation {
                                if value.translation.width < 0, showingMonth != startOfCurrentMonth {
                                    offset = value.translation.width * 0.9
                                } else if value.translation.width < 0, showingMonth == startOfCurrentMonth {
                                    offset = value.translation.width * 0.5
                                } else if value.translation.width > 0, showingMonth != startOfLastMonth {
                                    offset = value.translation.width * 0.9
                                } else if value.translation.width > 0, showingMonth == startOfLastMonth {
                                    offset = value.translation.width * 0.5
                                }
                            }
                        }.onEnded { _ in
                            if changeTime {
                                if offset < 0, showingMonth != startOfCurrentMonth {
                                    changeDate = true

                                    offset = UIScreen.main.bounds.width

                                    showingMonth = Calendar.current.date(byAdding: .month, value: 1, to: showingMonth) ?? Date.now

                                    withAnimation(.easeInOut(duration: 0.3)) {
                                        offset = 0
                                    }
                                } else if offset > 0, showingMonth != startOfLastMonth {
                                    changeDate = true

                                    offset = -UIScreen.main.bounds.width

                                    showingMonth = Calendar.current.date(byAdding: .month, value: -1, to: showingMonth) ?? Date.now

                                    withAnimation(.easeInOut(duration: 0.3)) {
                                        offset = 0
                                    }
                                }

                                withAnimation(.easeInOut(duration: 0.3)) {
                                    offset = 0
                                }

                                changeDate = false
                            }
                        }
                )
                .onChange(of: changeTime) { _, _ in
                    if changeTime {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    }
                }
                .onChange(of: isDragging) { _, _ in
                    if !isDragging && !changeDate {
                        withAnimation(.easeInOut(duration: 0.3)) {
                            offset = 0
                        }
                    }
                }
                .animation(.easeInOut, value: changeTime)
                .onChange(of: showingMonth) { _, _ in
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
                .padding(.bottom, incomeFiltering ? 5 : 20)
                
                Group {
                    if !incomeFiltering {
                        FilteredInsightsView(startDate: showingMonth, type: 2)
                            .padding(.bottom, 70)
                            .padding(.horizontal, 20)
                    } else {
                        if selectedDate == nil {
                            HorizontalPieChartView(date: showingMonth, categoryFilter: $categoryFilter, categoryFilterMode: $categoryFilterMode, selectedDate: $selectedDate, chosenAmount: $chosenCategoryAmount, chosenName: $chosenCategoryName, type: .month, income: income)
                                .padding(.horizontal, 30)
                                .padding(.bottom, 70)
                                .id(refreshID1)

                            if categoryFilterMode {
                                FilteredCategoryInsightsView(category: categoryFilter, date: showingMonth, type: .month)
                                    .padding(.bottom, 70)
                                    .padding(.horizontal, 20)
                            }
                        } else {
                            FilteredDateInsightsView(date: selectedDate ?? Date.now, income: income)
                                .padding(.bottom, 70)
                                .padding(.horizontal, 20)
                        }
                    }
                }

//                Group {
//                    if !incomeFiltering {
//                        FilteredInsightsView(startDate: showingMonth, type: 2)
//                            .padding(.bottom, 70)
//                    } else {
//                        if selectedDate != nil {
//                            FilteredDateInsightsView(date: selectedDate ?? Date.now, income: income)
//                                .padding(.bottom, 70)
//
//                        } else if categoryFilterMode {
//                            FilteredCategoryInsightsView(category: categoryFilter, date: showingMonth, type: .month)
//                                .padding(.bottom, 70)
//                        } else {
//                            FilteredInsightsView(startDate: showingMonth, income: income, type: 2)
//                                .padding(.bottom, 70)
//                        }
//                    }
//                }
//                .padding(.horizontal, 20)
//                .onTapGesture {
//                    selectedDate = nil
//                    categoryFilterMode = false
//                }
            }
        }
        .onReceive(self.didSave) { _ in
            self.refreshID = UUID()
            self.refreshID1 = UUID()
        }
    }
}

struct SingleMonthBarGraphView: View {
    @AppStorage("firstDayOfMonth", store: AppIdentifiers.sharedDefaults) var firstDayOfMonth: Int = 1

    @Binding var selectedDate: Date?
    @Binding var categoryFilterMode: Bool
    @Binding var selectedDateAmount: Double

    var daysOfMonth = [Date]()

    var dayDictionary = [Date: Double]()

    var max: Double = 0
    var monthTotal: Double = 0
    var monthAverage: Double = 0
    var actualDays: Int = 0

    var getMax: Int {
        let maximum = max * 1.1

        return Int(ceil(maximum / 10) * 10)
    }

    let numberArray = [1, 8, 15, 22, 29]

    var body: some View {
        ZStack(alignment: .top) {
            HStack(alignment: .top, spacing: 3) {
                // axes
                VStack(alignment: .leading) {
                    Text(getMaxText(maxi: getMax))
                        .font(.system(size: 12, weight: .regular, design: .rounded))
                        .foregroundStyle(Color.SubtitleText)

                    Spacer()

                    Text("0")
                        .font(.system(size: 12, weight: .regular, design: .rounded))
                        .foregroundStyle(Color.SubtitleText)

                }
                .frame(height: barHeight)
                .padding(.trailing, 3)

                // bars
                HStack(alignment: .top, spacing: 2) {
                    ForEach(daysOfMonth, id: \.self) { day in
                        ZStack(alignment: .bottom) {
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .fill(Color.SecondaryBackground)
                                .frame(height: barHeight)
                                .zIndex(0)

                            AnimatedBarGraph(index: daysOfMonth.firstIndex(of: day) ?? 0)
                                .frame(height: getBarHeight(point: dayDictionary[day] ?? 0, maxi: getMax))
                                .opacity(selectedDate == nil ? 1 : (selectedDate == day ? 1 : 0.4))
                                .zIndex(0)
                                .overlay(alignment: .bottom) {
                                    if numberArray.contains(((daysOfMonth.firstIndex(of: day) ?? -1) + 1)) && firstDayOfMonth == 1 {
                                        Text("\((daysOfMonth.firstIndex(of: day) ?? -1) + 1)")
                                            .font(.system(size: 12, weight: .bold, design: .rounded))
                                            .foregroundStyle(Color.SubtitleText)
                                            .frame(width: 20, alignment: .center)
                                            .offset(y: 20)
                                    }
                                }
                        }
                        .padding(.bottom, firstDayOfMonth == 1 ? 22 : 0)
                        .opacity(day > Date.now ? 0.3 : 1)
                        .frame(maxWidth: .infinity)
                        .allowsHitTesting(!(day > Date.now))
                        .onTapGesture {
                            withAnimation(.easeIn(duration: 0.2)) {
                                if selectedDate == day {
                                    selectedDate = nil
                                    categoryFilterMode = false
                                } else {
                                    selectedDate = day
                                    categoryFilterMode = false
                                }
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity)

            }
            .frame(maxWidth: .infinity)

            //                .frame(maxHeight: .infinity)

            // average line

            AverageLineView(getMax: getMax, average: monthAverage)
                .opacity(actualDays <= 1 ? 0 : 1)

        }
        .onChange(of: selectedDate) { _, _ in
            selectedDateAmount = dayDictionary[selectedDate ?? Date.now] ?? 0.0
        }
    }

    init(month: Date, date: Binding<Date?>?, mode: Binding<Bool>, amount: Binding<Double>, dataController: DataController, income: Bool) {
        _selectedDate = date ?? Binding.constant(nil)
        _categoryFilterMode = mode
        _selectedDateAmount = amount

        let loaded = dataController.getInsights(type: 2, date: month, income: income)

        daysOfMonth = loaded.dates
        dayDictionary = loaded.dateDictionary
        self.max = loaded.maximum
        monthTotal = loaded.amount
        monthAverage = loaded.average
        actualDays = loaded.numberOfDays
    }
}
