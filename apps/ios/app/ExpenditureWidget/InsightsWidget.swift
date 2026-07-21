//
//  InsightsWidget.swift
//  Outlayr
//
//  Created by Rafael Soh on 14/8/22.
//

import AppIntents
import Foundation
import SwiftUI
import WidgetKit

struct InsightsWidget: Widget {
    let kind: String = "InsightsWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: InsightsWidgetConfiguration.self, provider: InsightsProvider()) { entry in
            InsightsWidgetEntryView(entry: entry)
                .guardedByDataStore()
        }
        .configurationDisplayName("Insights")
        .description("Analyse your expenditure breakdowns over various time periods.")
        .supportedFamilies([.systemMedium])
    }
}

struct InsightsWidgetConfiguration: WidgetConfigurationIntent, CustomIntentMigratedAppIntent {
    // Existing widgets were configured through the SiriKit
    // InsightsWidgetConfigurationIntent; the system migrates their stored
    // parameters onto this intent by matching this class name plus the
    // parameter names and types below, so none of them may change.
    static let intentClassName = "InsightsWidgetConfigurationIntent"

    static var title: LocalizedStringResource = "Insights Widget Configuration"

    @Parameter(title: "Time Period", default: .week)
    var duration: InsightsTimePeriodAppEnum

    @Parameter(title: "Insights Type", default: .expenses)
    var income: IncomeAppEnum
}

// Raw values mirror the INEnumValueIndex values in
// WidgetConfiguration.intentdefinition so migrated configurations resolve to
// the same case the user originally picked.
enum InsightsTimePeriodAppEnum: Int, AppEnum {
    case week = 1
    case month = 2
    case year = 3

    static var typeDisplayRepresentation: TypeDisplayRepresentation = .init(name: "Insights Time Period")
    static var caseDisplayRepresentations: [InsightsTimePeriodAppEnum: DisplayRepresentation] = [
        .week: DisplayRepresentation(title: "Week"),
        .month: DisplayRepresentation(title: "Month"),
        .year: DisplayRepresentation(title: "Year")
    ]

    var timePeriod: InsightsTimePeriod {
        InsightsTimePeriod(rawValue: rawValue) ?? .week
    }
}

enum IncomeAppEnum: Int, AppEnum {
    case income = 1
    case expenses = 2

    static var typeDisplayRepresentation: TypeDisplayRepresentation = .init(name: "Income")
    static var caseDisplayRepresentations: [IncomeAppEnum: DisplayRepresentation] = [
        .income: DisplayRepresentation(title: "Income"),
        .expenses: DisplayRepresentation(title: "Expenses")
    ]
}

struct InsightsProvider: AppIntentTimelineProvider {
    typealias Intent = InsightsWidgetConfiguration

    public typealias Entry = InsightsWidgetEntry

    func placeholder(in _: Context) -> InsightsWidgetEntry {
        // Placeholder must return synchronously and is rendered redacted, so it
        // uses a static sample week instead of a store fetch (which would read
        // the view context off the main thread in this timeline callback).
        sampleEntry(duration: .week, income: true)
    }

    private func sampleEntry(duration: InsightsTimePeriod, income: Bool) -> InsightsWidgetEntry {
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: Date())
        let amounts: [Double] = [12, 5.5, 20, 0, 9, 14, 2.5]
        let dates = (0 ..< 7).map { calendar.date(byAdding: .day, value: $0 - 6, to: start)! }
        let total = amounts.reduce(0, +)

        return InsightsWidgetEntry(
            date: Date(),
            amount: total,
            duration: duration,
            maximum: amounts.max()!,
            dates: dates,
            dictionary: Dictionary(uniqueKeysWithValues: zip(dates, amounts)),
            numberOfDays: 6,
            average: total / 7,
            categories: [
                HoldingCategory(color: "#A0A0A0", name: "Food", percent: 0.45),
                HoldingCategory(color: "#C0C0C0", name: "Transport", percent: 0.35),
                HoldingCategory(color: "#E0E0E0", name: "Rent", percent: 0.2)
            ],
            income: income
        )
    }

    func snapshot(for configuration: InsightsWidgetConfiguration, in context: Context) async -> InsightsWidgetEntry {
        if context.isPreview {
            // The gallery preview must honor the chosen configuration, not the
            // placeholder's hardcoded earned-this-week sample.
            return sampleEntry(duration: configuration.duration.timePeriod, income: configuration.income == .income)
        }

        return await entry(for: configuration)
    }

    func timeline(for configuration: InsightsWidgetConfiguration, in _: Context) async -> Timeline<InsightsWidgetEntry> {
        Timeline(entries: [await entry(for: configuration)], policy: .atEnd)
    }

    private func entry(for configuration: InsightsWidgetConfiguration) async -> InsightsWidgetEntry {
        let duration = configuration.duration.timePeriod
        let income = configuration.income == .income

        let loaded = await loadData(type: duration, income: income)

        return InsightsWidgetEntry(date: Date(), amount: loaded.amount, duration: duration, maximum: loaded.maximum, dates: loaded.dates, dictionary: loaded.dateDictionary, numberOfDays: loaded.numberOfDays, average: loaded.average, categories: loaded.categories, income: income)
    }

    func loadData(type: InsightsTimePeriod, income: Bool) async -> (amount: Double, maximum: Double, average: Double, numberOfDays: Int, dates: [Date], dateDictionary: [Date: Double], categories: [HoldingCategory]) {
        guard DataController.storeIsAvailable else {
            // Broken app group: skip the store read. The entry view shows the error
            // placeholder via `guardedByDataStore()`; return the existing empty default.
            return (0, 0, 0, 0, [Date](), [Date: Double](), [HoldingCategory]())
        }

        // Fetch and bucket inside one background closure so no managed object
        // crosses the thread boundary into this timeline callback.
        let insights = await DataController.shared.transactions.getWidgetInsights(type: type, income: income)

        let categories = insights.categories.map {
            HoldingCategory(color: $0.color, name: $0.name, percent: $0.percent)
        }

        return (insights.amount, insights.maximum, insights.average, insights.numberOfDays, insights.dates, insights.dateDictionary, categories)
    }
}

struct InsightsWidgetEntry: TimelineEntry {
    let date: Date
    let amount: Double
    let duration: InsightsTimePeriod
    let maximum: Double
    let dates: [Date]
    let dictionary: [Date: Double]
    let numberOfDays: Int
    let average: Double
    let categories: [HoldingCategory]
    let income: Bool
}

struct InsightsWidgetEntryView: View {
    let entry: InsightsProvider.Entry

    let numberArray = [1, 8, 15, 22, 29]
    let monthNumberArray = [1, 4, 7, 10]
    let monthNames: [Int: String] = [1: "Jan", 4: "Apr", 7: "Jul", 10: "Oct"]

    @AppStorage("firstDayOfMonth", store: AppIdentifiers.sharedDefaults) var firstDayOfMonth: Int = 1
    @AppStorage("currency", store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency)!
    }

    @AppStorage("showCents", store: AppIdentifiers.sharedDefaults) var showCents: Bool = true

    var dollarText: String {
        if entry.amount < 10000 && showCents {
            return "\(String(format: "%.2f", entry.amount))"
        } else {
            return "\(Int(round(entry.amount)))"
        }
    }

    var subtitleText: String {
        switch entry.duration {
        case .unknown:
            return "NIL"
        case .week:
            return String(localized: "THIS WEEK").uppercased()
        case .month:
            return String(localized: "THIS MONTH").uppercased()
        case .year:
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy"
            return String(localized: "in \(formatter.string(from: Date.now))").uppercased()
        }
    }

    var subtitleText1: String {
        switch entry.duration {
        case .unknown:
            return "NIL"
        case .week:
            return String(localized: "THIS WEEK").uppercased()
        case .month:
            return String(localized: "THIS MONTH").uppercased()
        case .year:
            return String(localized: "THIS YEAR").uppercased()
        }
    }

    var verbText: String {
        if entry.income {
            return String(localized: "EARNED ").uppercased()
        } else {
            return String(localized: "SPENT ").uppercased()
        }
    }

    var body: some View {
            GeometryReader { proxy in
                HStack(spacing: 0) {
                    VStack(spacing: 8) {
                        VStack(alignment: .leading, spacing: -1) {
                            Text(verbText + subtitleText)
                                .font(.system(size: 10, weight: .semibold, design: .rounded))
                                .foregroundColor(Color.SubtitleText)

                            InsightsWidgetDollarView(currencySymbol: currencySymbol, dollarText: dollarText)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)

                        GeometryReader { proxy in
                            ZStack(alignment: .top) {
                                HStack(alignment: .top, spacing: 4) {
                                    // axes
                                    VStack(alignment: .leading) {
                                        Text(getMaxText())
                                            .lineLimit(1)
                                            .font(.system(size: 8, weight: .regular, design: .rounded))
                                            .foregroundColor(Color.SubtitleText)

                                        Spacer()

                                        Text("0")
                                            .font(.system(size: 8, weight: .regular, design: .rounded))
                                            .foregroundColor(Color.SubtitleText)
                                    }
                                    .frame(height: proxy.size.height * 0.85)

                                    if entry.duration == .week {
                                        HStack(spacing: 3) {
                                            ForEach(entry.dates, id: \.self) { day in
                                                VStack(spacing: 3) {
                                                    ZStack(alignment: .bottom) {
                                                        RoundedRectangle(cornerRadius: 3.5, style: .continuous)
                                                            .fill(Color.SecondaryBackground)
                                                            .frame(height: proxy.size.height * 0.85)

                                                        RoundedRectangle(cornerRadius: 3.5, style: .continuous)
                                                            .frame(height: getBarHeight(point: entry.dictionary[day]!, size: proxy.size))
                                                    }

                                                    Text(getWeekday(day: day).prefix(1))
                                                        .font(.system(size: 8, weight: .bold, design: .rounded))
                                                        .foregroundColor(Color.SubtitleText)
                                                }
                                                .opacity(day > Date.now ? 0.3 : 1)
                                                .frame(maxWidth: .infinity)
                                            }
                                        }
                                        .frame(maxWidth: .infinity)
                                    } else if entry.duration == .month {
                                        HStack(spacing: 1.5) {
                                            ForEach(entry.dates, id: \.self) { day in
                                                ZStack(alignment: .bottom) {
                                                    Capsule()
                                                        .fill(Color.SecondaryBackground)
                                                        .frame(height: proxy.size.height * 0.85)

                                                    Capsule()
                                                        .frame(height: getBarHeight(point: entry.dictionary[day]!, size: proxy.size))
                                                        .overlay(alignment: .bottom) {
                                                            if numberArray.contains((entry.dates.firstIndex(of: day) ?? -1) + 1) && firstDayOfMonth == 1 {
                                                                Text("\((entry.dates.firstIndex(of: day) ?? -1) + 1)")
                                                                    .font(.system(size: 8, weight: .bold, design: .rounded))
                                                                    .foregroundColor(Color.SubtitleText)
                                                                    .frame(width: 20, alignment: .center)
                                                                    .offset(y: 15)
                                                            }
                                                        }
                                                }
                                                .padding(.bottom, firstDayOfMonth == 1 ? 13 : 0)
                                                .opacity(day > Date.now ? 0.3 : 1)
                                                .frame(maxWidth: .infinity)
                                            }
                                        }
                                        .frame(maxWidth: .infinity)
                                    } else {
                                        HStack(spacing: 2.5) {
                                            ForEach(entry.dates, id: \.self) { day in
                                                ZStack(alignment: .bottom) {
                                                    RoundedRectangle(cornerRadius: 2.7, style: .continuous)
                                                        .fill(Color.SecondaryBackground)
                                                        .frame(height: proxy.size.height * 0.85)

                                                    RoundedRectangle(cornerRadius: 2.7, style: .continuous)
                                                        .frame(height: getBarHeight(point: entry.dictionary[day]!, size: proxy.size))
                                                        .overlay(alignment: .bottom) {
                                                            if monthNumberArray.contains((entry.dates.firstIndex(of: day) ?? -1) + 1) {
                                                                Text(LocalizedStringKey(monthNames[(entry.dates.firstIndex(of: day)! + 1)] ?? ""))
                                                                    .font(.system(size: 8, weight: .bold, design: .rounded))
                                                                    .foregroundColor(Color.SubtitleText)
                                                                    .frame(width: 20, alignment: .center)
                                                                    .offset(y: 15)
                                                            }
                                                        }
                                                }
                                                .padding(.bottom, 13)
                                                .opacity(day > Date.now ? 0.3 : 1)
                                                .frame(maxWidth: .infinity)
                                            }
                                        }
                                        .frame(maxWidth: .infinity)
                                    }
                                }
                                .frame(width: proxy.size.width)
                                .frame(maxHeight: .infinity)

                                HStack(spacing: 4) {
                                    Text(getAverageText())
                                        .lineLimit(1)
                                        .font(.system(size: 8, weight: .regular, design: .rounded))
                                        .foregroundColor(Color.PrimaryText)
                                        .opacity((entry.average / Double(getMax())) < 0.2 || (entry.average / Double(getMax())) > 0.8 ? 0 : 1)

                                    Line()
                                        .stroke(Color.SubtitleText, style: StrokeStyle(lineWidth: 2, lineCap: .round, dash: [5]))
                                        .frame(height: 1)
                                        .frame(maxWidth: .infinity)
                                }
                                .frame(width: proxy.size.width)
                                .opacity(entry.numberOfDays <= 1 ? 0 : 1)
                                .offset(y: getOffset(size: proxy.size) - 5)
                            }
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    }
                    .padding([.trailing], 20)
                    .frame(width: 185)
                    .frame(maxHeight: .infinity)
                    .background(Color.PrimaryBackground)

                    InsightsWidgetCategoryBreakdownView(amount: entry.amount, income: entry.income, categories: entry.categories, duration: entry.duration, ios17: true)
//                    .frame(width: proxy.size.width * 0.43)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .widgetURL(URL(string: AppIdentifiers.urlScheme + "insights"))
            .containerBackground(for: .widget) {
                Color.PrimaryBackground
            }
    }

    func getOffset(size: CGSize) -> Double {
        let maxi = getMax()

        if maxi == 0 {
            return 0
        } else {
            let height = (size.height * 0.85) - ((entry.average / Double(maxi)) * (size.height * 0.85))
            return height
        }
    }

    func getAverageText() -> String {
        let string = String(entry.average)

        let stringArray = string.compactMap { String($0) }

        if entry.average >= 1_000_000 {
            return stringArray[0] + "M"
        } else if entry.average >= 100_000 {
            return string.prefix(3) + "k"
        } else if entry.average >= 10000 {
            return string.prefix(2) + "k"
        } else if entry.average >= 1000 {
            return stringArray[0] + "." + stringArray[1] + "k"
        } else {
            return String(Int(round(entry.average)))
        }
    }

    func getMaxText() -> String {
        let maxi = getMax()

        if maxi == 0 {
            return "10"
        }

        let string = String(maxi)

        let stringArray = string.compactMap { String($0) }

        if maxi >= 1_000_000 {
            return stringArray[0] + "M"
        } else if maxi >= 100_000 {
            return string.prefix(3) + "k"
        } else if maxi >= 10000 {
            return string.prefix(2) + "k"
        } else if maxi >= 1000 {
            let string = String(maxi)

            let stringArray = string.compactMap { String($0) }

            return stringArray[0] + "." + stringArray[1] + "k"
        } else {
            return String(maxi)
        }
    }

    func getMax() -> Int {
        let maximum = entry.maximum * 1.1

        return Int(ceil(maximum / 10) * 10)
    }

    func getBarHeight(point: CGFloat, size: CGSize) -> CGFloat {
        let maxi = getMax()

        if maxi == 0 {
            return 0
        } else {
            let height = (point / CGFloat(maxi)) * (size.height * 0.85)
            return height
        }
    }

    func getWeekday(day: Date) -> String {
        let dateFormatter = DateFormatter()

        dateFormatter.dateFormat = "EEE"

        return dateFormatter.string(from: day)
    }
}
