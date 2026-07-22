//
//  WeekGraphView.swift
//  Outlayr

import Foundation
import CoreData
import SwiftUI

struct WeekGraphView: View {
    @FetchRequest(sortDescriptors: [
        SortDescriptor(\.day)
    ]) private var transactions: FetchedResults<Transaction>

    @AppStorage(DefaultsKey.currency, store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency)!
    }

    @AppStorage(DefaultsKey.showCents, store: AppIdentifiers.sharedDefaults) var showCents: Bool = true

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

    @State private var screenWidth: CGFloat = 0
    @State private var offset: CGFloat = 0
    @State private var changeDate: Bool = false
    @GestureState var isDragging = false
    var changeTime: Bool {
        if offset < -(screenWidth * 0.25) && showingWeek != startOfCurrentWeek {
            return true
        } else if offset > (screenWidth * 0.25) && showingWeek != startOfLastWeek {
            return true
        } else {
            return false
        }
//
//        return abs(offset) > screenWidth * 0.3
    }

    @State var showingWeek = Date.now

    @State private var refreshID1 = UUID()

    @State var chosenCategoryName = ""
    @State var chosenCategoryAmount = 0.0

    @AppStorage(DefaultsKey.insightsViewIncomeFiltering, store: AppIdentifiers.sharedDefaults) var income: Bool = true
    @AppStorage(DefaultsKey.incomeTracking, store: AppIdentifiers.sharedDefaults) var incomeTracking: Bool = true

    @State var incomeFiltering: Bool = true

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 18) {
                ZStack {
                    SingleGraphView(showingDate: showingWeek, date: $selectedDate, mode: $categoryFilterMode, categoryName: chosenCategoryName, categoryAmount: chosenCategoryAmount, currencySymbol: currencySymbol, showCents: showCents, income: $income, incomeFiltering: $incomeFiltering, type: 1)
                        .drawingGroup()
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

                                    offset = screenWidth

                                    showingWeek = Calendar.current.date(byAdding: .day, value: 7, to: showingWeek) ?? Date.now

                                    withAnimation(.easeInOut(duration: 0.3)) {
                                        offset = 0
                                    }
                                } else if offset > 0, showingWeek != startOfLastWeek {
                                    changeDate = true

                                    offset = -screenWidth

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
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { screenWidth = $0 }
    }
}
