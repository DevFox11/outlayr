//
//  YearGraphView.swift
//  Outlayr
//

import Accessibility
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
        .accessibilityElement(children: .ignore)
        .accessibilityChartDescriptor(self)
        .accessibilityLabel("Yearly spending chart")
        .accessibilityValue(actualMonths > 1 ? "Average \(String(format: "%.0f", yearAverage)) per month" : "No data")
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

extension SingleYearBarGraphView: AXChartDescriptorRepresentable {
    func makeChartDescriptor() -> AXChartDescriptor {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM"

        let pastMonths = monthsOfYear.filter { $0 <= Date.now }.sorted()
        let labels = pastMonths.map { formatter.string(from: $0) }

        let xAxis = AXCategoricalDataAxisDescriptor(title: "Month", categoryOrder: labels)
        let yAxis = AXNumericDataAxisDescriptor(
            title: "Amount",
            range: 0...Swift.max(1, max * 1.1),
            gridlinePositions: []
        ) { String(format: "%.0f", $0) }

        let series = AXDataSeriesDescriptor(
            name: "Spending",
            isContinuous: false,
            dataPoints: zip(labels, pastMonths).map { label, month in
                AXDataPoint(x: label, y: monthDictionary[month] ?? 0)
            }
        )

        return AXChartDescriptor(
            title: "Yearly spending",
            summary: actualMonths > 1 ? "Average \(String(format: "%.0f", yearAverage)) per month" : nil,
            xAxis: xAxis,
            yAxis: yAxis,
            additionalAxes: [],
            series: [series]
        )
    }
}
