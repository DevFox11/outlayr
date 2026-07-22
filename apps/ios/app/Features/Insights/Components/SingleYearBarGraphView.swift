//
//  YearGraphView.swift
//  Outlayr
//

import Foundation
import SwiftUI

struct SingleYearBarGraphView: View {
    @Binding var selectedDate: Date?
    @Binding var categoryFilterMode: Bool
    @Binding var selectedDateAmount: Double

    var monthsOfYear = [Date]()

    var monthDictionary = [Date: Double]()

    var max: Double = 0

    var getMax: Int {
        let maximum = max * 1.1

        return Int(ceil(maximum / 10) * 10)
    }

    var yearAverage: Double = 0
    var actualMonths: Int = 0

    let numberArray = [1, 4, 7, 10]
    let monthNames: [Int: String] = [1: "Jan", 4: "Apr", 7: "Jul", 10: "Oct"]

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
                HStack(alignment: .top, spacing: 4) {
                    ForEach(monthsOfYear, id: \.self) { month in
                        ZStack(alignment: .bottom) {
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .fill(Color.SecondaryBackground)
                                .frame(height: barHeight)
                                .zIndex(0)

                            AnimatedBarGraph(index: monthsOfYear.firstIndex(of: month) ?? 0)
                                .frame(height: getBarHeight(point: monthDictionary[month] ?? 0, maxi: getMax))
                                .opacity(selectedDate == nil ? 1 : (selectedDate == month ? 1 : 0.4))
                                .zIndex(0)
                                .overlay(alignment: .bottom) {
                                    if numberArray.contains(((monthsOfYear.firstIndex(of: month) ?? 0) + 1)) {
                                        Text(LocalizedStringKey(monthNames[((monthsOfYear.firstIndex(of: month) ?? 0) + 1)] ?? ""))
                                            .scaledFont(12, weight: .bold, design: .rounded)
                                            .foregroundStyle(Color.SubtitleText)
                                            .frame(width: 30)
                                            .offset(y: 20)
                                    }
                                }
                        }
                        .padding(.bottom, 22)
                        .opacity(month > Date.now ? 0.3 : 1)
                        .frame(maxWidth: .infinity)
                        .allowsHitTesting(!(month > Date.now))
                        .onTapGesture {
                            withAnimation(.easeIn(duration: 0.2)) {
                                if selectedDate == month {
                                    selectedDate = nil
                                    categoryFilterMode = false
                                } else {
                                    selectedDate = month
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

            AverageLineView(getMax: getMax, average: yearAverage)
                .opacity(actualMonths <= 1 ? 0 : 1)

        }
        .onChange(of: selectedDate) { _, _ in
            selectedDateAmount = monthDictionary[selectedDate ?? Date.now] ?? 0.0
        }
    }

    func getMonth(month: Date) -> String {
        let dateFormatter = DateFormatter()

        dateFormatter.dateFormat = "M"

        return dateFormatter.string(from: month)
    }

    init(insights: TransactionRepository.GraphViewInsights.PeriodBreakdown, date: Binding<Date?>?, mode: Binding<Bool>, amount: Binding<Double>) {
        _selectedDate = date ?? Binding.constant(nil)
        _categoryFilterMode = mode
        _selectedDateAmount = amount

        monthsOfYear = insights.dates
        monthDictionary = insights.dateDictionary
        self.max = insights.maximum
        yearAverage = insights.average
        actualMonths = insights.numberOfDays
    }
}
