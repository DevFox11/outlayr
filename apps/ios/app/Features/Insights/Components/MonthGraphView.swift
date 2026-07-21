//
//  MonthGraphView.swift
//  Outlayr
//

import Foundation
import CoreData
import SwiftUI

struct MonthGraphView: View {
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
                    SingleGraphView(showingDate: showingMonth, date: $selectedDate, mode: $categoryFilterMode, categoryName: chosenCategoryName, categoryAmount: chosenCategoryAmount, currencySymbol: currencySymbol, showCents: showCents, income: $income, incomeFiltering: $incomeFiltering, type: 2)
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
