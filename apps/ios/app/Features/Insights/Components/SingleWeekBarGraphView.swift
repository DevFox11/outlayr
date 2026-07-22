//
//  WeekGraphView.swift
//  Outlayr
//

import Accessibility
import Foundation
import SwiftUI

struct SingleWeekBarGraphView: View {
    @Binding var selectedDate: Date?
    @Binding var categoryFilterMode: Bool
    @Binding var selectedDateAmount: Double

    @State private var refreshID = UUID()

    var daysOfWeek = [Date]()

    var dayDictionary = [Date: Double]()

    var max: Double = 0
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
                                .scaledFont(12, weight: .bold, design: .rounded)
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
        .accessibilityElement(children: .ignore)
        .accessibilityChartDescriptor(self)
        .accessibilityLabel(String(localized: "accessibility.weeklySpendingChart"))
        .accessibilityValue(actualDays > 1 ? String(format: String(localized: "accessibility.averagePerDay"), String(format: "%.0f", weekAverage)) : String(localized: "accessibility.noData"))
    }

    func getWeekday(day: Date) -> String {
        let dateFormatter = DateFormatter()

        dateFormatter.dateFormat = "EEE"

        return dateFormatter.string(from: day)
    }

    init(insights: TransactionRepository.GraphViewInsights.PeriodBreakdown, date: Binding<Date?>?, mode: Binding<Bool>, amount: Binding<Double>) {
        _selectedDate = date ?? Binding.constant(nil)
        _categoryFilterMode = mode
        _selectedDateAmount = amount

        daysOfWeek = insights.dates
        dayDictionary = insights.dateDictionary
        self.max = insights.maximum
        weekAverage = insights.average
        actualDays = insights.numberOfDays
    }
}

extension SingleWeekBarGraphView: AXChartDescriptorRepresentable {
    func makeChartDescriptor() -> AXChartDescriptor {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE d"

        let pastDays = daysOfWeek.filter { $0 <= Date.now }.sorted()
        let labels = pastDays.map { formatter.string(from: $0) }

        let xAxis = AXCategoricalDataAxisDescriptor(title: "Day", categoryOrder: labels)
        let yAxis = AXNumericDataAxisDescriptor(
            title: "Amount",
            range: 0...Swift.max(1, max * 1.1),
            gridlinePositions: []
        ) { String(format: "%.0f", $0) }

        let series = AXDataSeriesDescriptor(
            name: "Spending",
            isContinuous: false,
            dataPoints: zip(labels, pastDays).map { label, day in
                AXDataPoint(x: label, y: dayDictionary[day] ?? 0)
            }
        )

        return AXChartDescriptor(
            title: "Weekly spending",
            summary: actualDays > 1 ? "Average \(String(format: "%.0f", weekAverage)) per day" : nil,
            xAxis: xAxis,
            yAxis: yAxis,
            additionalAxes: [],
            series: [series]
        )
    }
}
