//
//  WeekGraphView.swift
//  Outlayr
//

import Foundation
import Popovers
import CoreData
import SwiftUI

struct WeekGraphView: View {
    @Environment(DataController.self) private var dataController

    private var didSave = NotificationCenter.default.publisher(for: .NSManagedObjectContextDidSave)
    @State private var refreshID = UUID()

    @FetchRequest(sortDescriptors: [
        SortDescriptor(\.day)
    ]) private var transactions: FetchedResults<Transaction>

    @AppStorage("currency", store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency)!
    }

    @AppStorage("showCents", store: AppIdentifiers.sharedDefaults) var showCents: Bool = true

    @State var categoryFilterMode = false
    @State var categoryFilter: Category?

    @State var selectedDate: Date?

    var startOfCurrentWeek: Date {
        var calendar = Calendar(identifier: .gregorian)
        calendar.firstWeekday = AppIdentifiers.sharedDefaults?.integer(forKey: "firstWeekday") ?? 0
        calendar.minimumDaysInFirstWeek = 4

        let dateComponents = calendar.dateComponents([.weekOfYear, .yearForWeekOfYear], from: Date.now)

        return calendar.date(from: dateComponents) ?? Date.now
    }

    // start of week of final transaction
    var startOfLastWeek: Date {
        if transactions.isEmpty {
            return Date.now
        } else {
            var calendar = Calendar(identifier: .gregorian)
            calendar.firstWeekday = AppIdentifiers.sharedDefaults?.integer(forKey: "firstWeekday") ?? 0
            calendar.minimumDaysInFirstWeek = 4

            if let date = transactions[0].day {
                let dateComponents = calendar.dateComponents([.weekOfYear, .yearForWeekOfYear], from: date)

                return calendar.date(from: dateComponents) ?? Date.now
            } else {
                return Date.now
            }
        }
    }

    var swipeStrings: (backward: String, forward: String) {
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "d MMM"

        let calendar = Calendar.current

        let startOfLastWeek = calendar.date(byAdding: .day, value: -7, to: showingWeek) ?? Date.now
        let startOfNextWeek = calendar.date(byAdding: .day, value: 7, to: showingWeek) ?? Date.now

        return (dateFormatter.string(from: startOfLastWeek), dateFormatter.string(from: startOfNextWeek))
    }

    @State private var offset: CGFloat = 0
    @State private var changeDate: Bool = false
    @GestureState var isDragging = false
    var changeTime: Bool {
        if offset < -(UIScreen.main.bounds.width * 0.25) && showingWeek != startOfCurrentWeek {
            return true
        } else if offset > (UIScreen.main.bounds.width * 0.25) && showingWeek != startOfLastWeek {
            return true
        } else {
            return false
        }
//
//        return abs(offset) > UIScreen.main.bounds.width * 0.3
    }

    @State var showingWeek = Date.now

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
                    SingleGraphView(showingDate: showingWeek, date: $selectedDate, mode: $categoryFilterMode, categoryName: chosenCategoryName, categoryAmount: chosenCategoryAmount, currencySymbol: currencySymbol, showCents: showCents, dataController: dataController, income: $income, incomeFiltering: $incomeFiltering, type: 1)
                        .drawingGroup()
                        .id(refreshID)
                        .onAppear {
                            showingWeek = startOfCurrentWeek
                        }
                        .offset(x: offset)

                    if !changeDate {
                        HStack {
                            if showingWeek != startOfLastWeek {
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

                            if showingWeek != startOfCurrentWeek {
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
                                if value.translation.width < 0, showingWeek != startOfCurrentWeek {
                                    offset = value.translation.width * 0.9
                                } else if value.translation.width < 0, showingWeek == startOfCurrentWeek {
                                    offset = value.translation.width * 0.5
                                } else if value.translation.width > 0, showingWeek != startOfLastWeek {
                                    offset = value.translation.width * 0.9
                                } else if value.translation.width > 0, showingWeek == startOfLastWeek {
                                    offset = value.translation.width * 0.5
                                }
                            }
                        }.onEnded { _ in
                            if changeTime {
                                if offset < 0, showingWeek != startOfCurrentWeek {
                                    changeDate = true

                                    offset = UIScreen.main.bounds.width

                                    showingWeek = Calendar.current.date(byAdding: .day, value: 7, to: showingWeek) ?? Date.now

                                    withAnimation(.easeInOut(duration: 0.3)) {
                                        offset = 0
                                    }
                                } else if offset > 0, showingWeek != startOfLastWeek {
                                    changeDate = true

                                    offset = -UIScreen.main.bounds.width

                                    showingWeek = Calendar.current.date(byAdding: .day, value: -7, to: showingWeek) ?? Date.now

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
                .onChange(of: showingWeek) { _, _ in
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
                .padding(.bottom, incomeFiltering ? 5 : 10)

                Group {
                    if !incomeFiltering {
                        FilteredInsightsView(startDate: showingWeek, type: 1)
                            .padding(.bottom, 70)
                            .padding(.horizontal, 20)
                    } else {
                        if selectedDate == nil {
                            HorizontalPieChartView(date: showingWeek, categoryFilter: $categoryFilter, categoryFilterMode: $categoryFilterMode, selectedDate: $selectedDate, chosenAmount: $chosenCategoryAmount, chosenName: $chosenCategoryName, type: .week, income: income)
                                .padding(.horizontal, 30)
                                .padding(.bottom, 70)
                                .id(refreshID1)

                            if categoryFilterMode {
                                FilteredCategoryInsightsView(category: categoryFilter, date: showingWeek, type: .week)
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
                .onTapGesture {
                    selectedDate = nil
                    categoryFilterMode = false
                }
            }
        }
        .onReceive(self.didSave) { _ in
            self.refreshID = UUID()
            self.refreshID1 = UUID()
        }
    }
}

struct AverageLineView: View {
    var getMax: Int
    var average: Double

//    @State var showLine: Bool = false
//    @State var offset: CGFloat

//    var calculatedOffset: CGFloat {
//        return getOffset(maxi: getMax, average: average)
//    }

    var body: some View {
        HStack(spacing: 2) {
            PencilView(text: getAverageText(average: average))

            Line()
                .stroke(Color.SubtitleText, style: StrokeStyle(lineWidth: 2, lineCap: .round, dash: [5]))
                .frame(height: 1)
                .frame(maxWidth: .infinity)
        }
//        .opacity(showLine ? 1 : 0)
        .offset(y: getOffset(maxi: getMax, average: average))
        .opacity((average / Double(getMax)) < 0.1 || (average / Double(getMax)) > 0.9 ? 0 : 1)
//        .onAppear {
//            DispatchQueue.main.sync {
//                withAnimation(.interactiveSpring(response: 0.6, dampingFraction: 0.8, blendDuration: 0.8)) {
//                    print(calculatedOffset)
//                    offset = calculatedOffset
//                }
//            }
//        }
//        .onChange(of: showLine) { newValue in
//            if newValue {
//                DispatchQueue.main.asyncAfter(deadline: .now()) {
//                    if !animated {
//                        offset = calculatedOffset
//                    } else {
//                        
//                    }
//                }
//            }
//        }
//        .onChange(of: calculatedOffset) { newValue in
//            print(calculatedOffset)
//            if newValue != 0 {
//                if showLine {
//                    if !animated {
//                        offset = calculatedOffset
//                    } else {
//                        withAnimation(.interactiveSpring(response: 0.6, dampingFraction: 0.8, blendDuration: 0.8)) {
//                            offset = calculatedOffset
//                        }
//                    }
//                }
//            }
//        }

    }
}

struct SingleWeekBarGraphView: View {
    @Binding var selectedDate: Date?
    @Binding var categoryFilterMode: Bool
    @Binding var selectedDateAmount: Double

    @State private var refreshID = UUID()

    var daysOfWeek = [Date]()

    var dayDictionary = [Date: Double]()

    var max: Double = 0
    var weekTotal: Double = 0
    var weekAverage: Double = 0
    var actualDays: Int = 0

    var getMax: Int {
        let maximum = max * 1.1

        return Int(ceil(maximum / 10) * 10)
    }

    var body: some View {
        ZStack(alignment: .top) {
            HStack(alignment: .top, spacing: 8) {
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
                HStack(spacing: 7) {
                    ForEach(daysOfWeek, id: \.self) { day in
                        VStack(spacing: 5) {
                            ZStack(alignment: .bottom) {
                                RoundedRectangle(cornerRadius: 6, style: .continuous)
                                    .fill(Color.SecondaryBackground)
                                    .frame(height: barHeight)

                                AnimatedBarGraph(index: daysOfWeek.firstIndex(of: day) ?? 0)
                                    .frame(height: getBarHeight(point: dayDictionary[day] ?? 0, maxi: getMax))
                                    .opacity(selectedDate == nil ? 1 : (selectedDate == day ? 1 : 0.4))
                            }

                            Text(getWeekday(day: day).prefix(1))
                                .font(.system(size: 12, weight: .bold, design: .rounded))
                                .foregroundStyle(Color.SubtitleText)
                        }
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

            // average line
            AverageLineView(getMax: getMax, average: weekAverage)
                .opacity(actualDays <= 1 ? 0 : 1)
                .id(refreshID)

        }
        .onChange(of: selectedDate) { _, _ in
            selectedDateAmount = dayDictionary[selectedDate ?? Date.now] ?? 0.0
            refreshID = UUID()
        }
    }

    func getWeekday(day: Date) -> String {
        let dateFormatter = DateFormatter()

        dateFormatter.dateFormat = "EEE"

        return dateFormatter.string(from: day)
    }

    init(week: Date, date: Binding<Date?>?, mode: Binding<Bool>, amount: Binding<Double>, dataController: DataController, income: Bool) {
        _selectedDate = date ?? Binding.constant(nil)
        _categoryFilterMode = mode
        _selectedDateAmount = amount

        let loaded = dataController.getInsights(type: 1, date: week, income: income)

        daysOfWeek = loaded.dates
        dayDictionary = loaded.dateDictionary
        self.max = loaded.maximum
        weekTotal = loaded.amount
        weekAverage = loaded.average
        actualDays = loaded.numberOfDays
    }
}
