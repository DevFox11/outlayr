//
//  MonthGraphView.swift
//  Outlayr

import Foundation
import SwiftUI

struct SingleMonthBarGraphView: View {
    @AppStorage(DefaultsKey.firstDayOfMonth, store: AppIdentifiers.sharedDefaults) var firstDayOfMonth: Int = 1

    @Binding var selectedDate: Date?
    @Binding var categoryFilterMode: Bool
    @Binding var selectedDateAmount: Double

    var daysOfMonth = [Date]()

    var dayDictionary = [Date: Double]()

    var max: Double = 0
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
                        .scaledFont(12, weight: .regular, design: .rounded)
                        .foregroundStyle(Color.SubtitleText)

                    Spacer()

                    Text("0")
                        .scaledFont(12, weight: .regular, design: .rounded)
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
                                            .scaledFont(12, weight: .bold, design: .rounded)
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

    init(insights: TransactionRepository.GraphViewInsights.PeriodBreakdown, date: Binding<Date?>?, mode: Binding<Bool>, amount: Binding<Double>) {
        _selectedDate = date ?? Binding.constant(nil)
        _categoryFilterMode = mode
        _selectedDateAmount = amount

        daysOfMonth = insights.dates
        dayDictionary = insights.dateDictionary
        self.max = insights.maximum
        monthAverage = insights.average
        actualDays = insights.numberOfDays
    }
}
