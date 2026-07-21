//
//  RecentTransactionsWidget.swift
//  ExpenditureWidgetExtension
//
//  Created by Rafael Soh on 12/8/22.
//

import AppIntents
import SwiftUI
import WidgetKit

struct RecentTransactionsWidget: Widget {
    let kind: String = "ExpenditureWidget"

    private var supportedFamilies: [WidgetFamily] {
        if #available(iOSApplicationExtension 17, *) {
            return [
                .accessoryRectangular,
                .accessoryInline,
                .systemSmall,
                .systemLarge
            ]
        } else {
            return [
                .accessoryRectangular,
                .accessoryInline,
                .systemSmall
            ]
        }
    }

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: RecentWidgetConfiguration.self, provider: Provider()) { entry in
            ExpenditureWidgetEntryView(entry: entry)
                .guardedByDataStore()
        }
        .configurationDisplayName("Recent Transactions")
        .description("View your latest expenses.")
        .supportedFamilies(supportedFamilies)
    }
}

struct RecentWidgetConfiguration: WidgetConfigurationIntent, CustomIntentMigratedAppIntent {
    // Existing widgets were configured through the SiriKit
    // RecentWidgetConfigurationIntent; the system migrates their stored
    // parameters onto this intent by matching this class name plus the
    // parameter names and types below, so none of them may change.
    static let intentClassName = "RecentWidgetConfigurationIntent"

    static var title: LocalizedStringResource = "Recent Widget Configuration"

    @Parameter(title: "Time Period", default: .week)
    var duration: TimePeriodAppEnum

    @Parameter(title: "Insights Type", default: .net)
    var insightsType: InsightsTypeAppEnum
}

// Raw values mirror the INEnumValueIndex values in
// WidgetConfiguration.intentdefinition so migrated configurations resolve to
// the same case the user originally picked.
enum TimePeriodAppEnum: Int, AppEnum {
    case day = 1
    case week = 2
    case month = 3
    case year = 4

    static var typeDisplayRepresentation: TypeDisplayRepresentation = .init(name: "Time Period")
    static var caseDisplayRepresentations: [TimePeriodAppEnum: DisplayRepresentation] = [
        .day: DisplayRepresentation(title: "Day"),
        .week: DisplayRepresentation(title: "Week"),
        .month: DisplayRepresentation(title: "Month"),
        .year: DisplayRepresentation(title: "Year")
    ]

    var timePeriod: TimePeriod {
        TimePeriod(rawValue: rawValue) ?? .week
    }
}

enum InsightsTypeAppEnum: Int, AppEnum {
    case net = 1
    case income = 2
    case expense = 3

    static var typeDisplayRepresentation: TypeDisplayRepresentation = .init(name: "Insights Type")
    static var caseDisplayRepresentations: [InsightsTypeAppEnum: DisplayRepresentation] = [
        .net: DisplayRepresentation(title: "Net Total"),
        .income: DisplayRepresentation(title: "Total Income"),
        .expense: DisplayRepresentation(title: "Total Expenditure")
    ]

    var insightsType: InsightsType {
        InsightsType(rawValue: rawValue) ?? .net
    }
}

struct Provider: AppIntentTimelineProvider {
    typealias Intent = RecentWidgetConfiguration

    public typealias Entry = RecentWidgetEntry

    func placeholder(in _: Context) -> RecentWidgetEntry {
        // Placeholder must return synchronously and is rendered redacted, so it
        // uses static sample rows instead of a store fetch (which would read the
        // view context off the main thread in this timeline callback).
        RecentWidgetEntry(
            date: Date(),
            amount: 0,
            transactions: [
                HoldingTransaction(color: "#A0A0A0", note: "Coffee", amount: 4.5, income: false),
                HoldingTransaction(color: "#A0A0A0", note: "Groceries", amount: 32, income: false),
                HoldingTransaction(color: "#A0A0A0", note: "Transport", amount: 12, income: false)
            ],
            duration: .week,
            type: .net
        )
    }

    func snapshot(for configuration: RecentWidgetConfiguration, in context: Context) async -> RecentWidgetEntry {
        if context.isPreview {
            return placeholder(in: context)
        }

        return await entry(for: configuration)
    }

    func timeline(for configuration: RecentWidgetConfiguration, in _: Context) async -> Timeline<RecentWidgetEntry> {
        Timeline(entries: [await entry(for: configuration)], policy: .atEnd)
    }

    private func entry(for configuration: RecentWidgetConfiguration) async -> RecentWidgetEntry {
        let duration = configuration.duration.timePeriod
        let type = configuration.insightsType.insightsType

        return RecentWidgetEntry(date: Date(), amount: await loadAmount(type: duration, insightsType: type), transactions: await loadTransactions(type: duration, count: 9), duration: duration, type: type)
    }

    func loadAmount(type: TimePeriod, insightsType: InsightsType) async -> Double {
        guard DataController.storeIsAvailable else {
            // Broken app group: skip the store read; the entry view shows the error
            // placeholder via `guardedByDataStore()`. Return the existing zero default.
            return 0
        }

        let dataController = DataController.shared

        let timeframe: Int

        switch type {
        case .day:
            timeframe = 1
        case .week:
            timeframe = 2
        case .month:
            timeframe = 3
        case .year:
            timeframe = 4
        default:
            timeframe = 0
        }

        switch insightsType {
        case .net:
            let (amount, positive) = await dataController.transactions.getLogViewTotalNet(type: timeframe)

            if positive {
                return amount
            } else {
                return -amount
            }

        case .income:
            return await dataController.transactions.getLogViewTotalIncome(type: timeframe)
        case .expense:
            return await dataController.transactions.getLogViewTotalSpent(type: timeframe)
        default:
            return 0
        }
    }

    func loadTransactions(type: TimePeriod, count: Int) async -> [HoldingTransaction] {
        guard DataController.storeIsAvailable else {
            // Broken app group: skip the store read; the entry view shows the error
            // placeholder via `guardedByDataStore()`. Return the existing empty default.
            return []
        }

        // Fetch and map inside one background closure so no managed object
        // crosses the thread boundary into this timeline callback.
        return await DataController.shared.transactions.getRecentTransactions(type: type, count: count) { transaction in
            HoldingTransaction(color: transaction.effectiveColor, note: transaction.wrappedNote, amount: transaction.wrappedAmount, income: transaction.income)
        }
    }
}

struct RecentWidgetEntry: TimelineEntry {
    let date: Date
    let amount: Double
    let transactions: [HoldingTransaction]
    let duration: TimePeriod
    let type: InsightsType
}

struct ExpenditureWidgetEntryView: View {
    @Environment(\.widgetFamily) var widgetFamily
    let entry: Provider.Entry

    @AppStorage("currency", store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency)!
    }

    @AppStorage("showCents", store: AppIdentifiers.sharedDefaults) var showCents: Bool = true

    var inlineSubtitleText: String {
        switch entry.duration {
        case .unknown:
            return "NIL"
        case .day:
            return String(localized: "today")
        case .week:
            return String(localized: "this week")
        case .month:
            let formatter = DateFormatter()
            formatter.dateFormat = "MMM"
            return String(localized: "in \(formatter.string(from: Date.now))")
        case .year:
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy"
            return String(localized: "in \(formatter.string(from: Date.now))")
        }
    }

    var typeText: String {
        switch entry.type {
        case .unknown:
            return ""
        case .net:
            return String(localized: "net")
        case .income:
            return String(localized: "earned")
        case .expense:
            return String(localized: "spent")
        }
    }

    var positivityText: String {
        switch entry.type {
        case .unknown:
            return ""
        case .net:
            if entry.amount > 0 {
                return "+"
            } else {
                return "-"
            }
        case .income:
            return "+"
        case .expense:
            return "-"
        }
    }

    var body: some View {
        switch widgetFamily {
        case .accessoryInline:
            if entry.amount == 0 {
                Text("\(currencySymbol)0 \(typeText) \(inlineSubtitleText)")
            } else {
                Text("\(positivityText)\(currencySymbol)\(abs(entry.amount), specifier: (showCents && entry.amount < 1000) ? "%.2f" : "%.0f") \(inlineSubtitleText)")
            }
        case .accessoryRectangular:
                if entry.transactions.count == 0 {
                    Text("NO RECENT EXPENSES")
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .multilineTextAlignment(.center)
                        .containerBackground(for: .widget) { Color.clear }
                } else {
                    GeometryReader { proxy in
                        VStack(alignment: .leading, spacing: 2) {
                            ForEach(entry.transactions.prefix(3), id: \.self) { transaction in
                                HStack(spacing: 3) {
                                    Text(transaction.note)
                                        .fontWeight(.semibold)
                                        .lineLimit(1)
                                        .frame(maxWidth: .infinity, alignment: .leading)

                                    Text("\(transaction.income ? "+" : "-")\(currencySymbol)\(transaction.amount, specifier: (showCents && transaction.amount < 100) ? "%.2f" : "%.0f")")
                                        .fontWeight(.regular)
                                        .layoutPriority(1)
                                        .lineLimit(1)
                                }
                                .font(.system(size: getRectangularWidgetFont(width: proxy.size.width), design: .rounded))
                            }
                        }
                        .frame(width: proxy.size.width, height: proxy.size.height)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .containerBackground(for: .widget) { Color.clear }
                }
        case .systemSmall:
                GeometryReader { proxy in
                    VStack(spacing: 0) {
                        VStack(spacing: 0) {
                            Text((typeText + " " + inlineSubtitleText).uppercased())
                                .font(.system(size: 9, weight: .semibold, design: .rounded))
                                .foregroundColor(Color.SubtitleText)

                            RecentTransactionsDollarView(amount: entry.amount, showCents: showCents, net: entry.type == .net, bigger: true)
                            .frame(maxWidth: .infinity)
                            .frame(height: proxy.size.height * 0.27)
                        }
                        .frame(maxWidth: .infinity)

                        if entry.transactions.isEmpty {
                            VStack(spacing: 5) {
                                Text("NO RECENT EXPENSES")
                                    .font(.system(size: 9, weight: .medium, design: .rounded))
                                    .foregroundColor(Color.SubtitleText)
                                    .frame(maxHeight: .infinity)

                                HStack(spacing: 5) {
                                    Image(systemName: "plus")
                                        .font(.system(size: 10, weight: .medium, design: .rounded))

                                    Text("New Expense")
                                        .font(.system(size: 12, weight: .medium, design: .rounded))
                                        .foregroundColor(Color.PrimaryText)
                                }
                                .padding(.vertical, 5)
                                .frame(maxWidth: .infinity)
                                .background(RoundedRectangle(cornerRadius: 8).fill(Color.SecondaryBackground))
                                .frame(maxHeight: .infinity, alignment: .bottom)
                            }
                            .padding(.top, 12)

                        } else {
                            VStack(alignment: .leading, spacing: 5) {
                                Text("RECENT EXPENSES")
                                    .font(.system(size: 9, weight: .medium, design: .rounded))
                                    .foregroundColor(Color.SubtitleText)

                                ForEach(entry.transactions.prefix(3), id: \.self) { transaction in
                                    HStack(spacing: 5) {
                                        Capsule()
                                            .fill(Color(hex: transaction.color))
                                            .frame(width: 4, height: 12)

                                        Text(transaction.note)
                                            .lineLimit(1)
                                            .font(.system(size: 13, weight: .regular, design: .rounded))
                                            .foregroundColor(Color.PrimaryText)
                                            .frame(maxWidth: .infinity, alignment: .leading)

                                        if transaction.income {
                                            Text("+\(currencySymbol)\(transaction.amount, specifier: (showCents && transaction.amount < 100) ? "%.2f" : "%.0f")")
                                                .font(.system(size: 13, weight: .regular, design: .rounded))
                                                .foregroundColor(Color.IncomeGreen)
                                                .lineLimit(1)
                                                .layoutPriority(1)
                                        } else {
                                            Text("-\(currencySymbol)\(transaction.amount, specifier: (showCents && transaction.amount < 100) ? "%.2f" : "%.0f")")
                                                .font(.system(size: 13, weight: .regular, design: .rounded))
                                                .foregroundColor(Color.SubtitleText)
                                                .lineLimit(1)
                                                .layoutPriority(1)
                                        }
                                    }
                                }

                                if entry.transactions.count < 2 {
                                    HStack(spacing: 5) {
                                        Image(systemName: "plus")
                                            .font(.system(size: 10, weight: .medium, design: .rounded))

                                        Text("New Expense")
                                            .font(.system(size: 12, weight: .medium, design: .rounded))
                                            .foregroundColor(Color.PrimaryText)
                                    }
                                    .padding(.vertical, 5)
                                    .frame(maxWidth: .infinity)
                                    .background(RoundedRectangle(cornerRadius: 8).fill(Color.SecondaryBackground))
                                    .frame(maxHeight: .infinity, alignment: .bottom)
                                }
                            }
                            .padding(.top, entry.transactions.count >= 3 ? 5 : 10)
                            .frame(maxHeight: .infinity, alignment: .top)
                        }
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .containerBackground(for: .widget) {
                    Color.PrimaryBackground
                }
                .widgetURL(entry.transactions.count < 2 ? URL(string: AppIdentifiers.urlScheme + "newExpense") : nil)
                .dynamicTypeSize(...DynamicTypeSize.xxxLarge)

        case .systemLarge:
                GeometryReader { _ in
                    VStack(spacing: 0) {
                        VStack(spacing: 0) {
                            Text((typeText + " " + inlineSubtitleText).uppercased())
                                .font(.system(size: 12, weight: .semibold, design: .rounded))
                                .foregroundColor(Color.SubtitleText)

                            RecentTransactionsDollarView(amount: entry.amount, showCents: showCents, net: entry.type == .net)
                                .frame(maxWidth: .infinity)
                        }
                        .frame(maxWidth: .infinity)

                        Spacer()
                            .frame(minHeight: 5, idealHeight: 15, maxHeight: 20)
                            .fixedSize()

                        if entry.transactions.isEmpty {
                            VStack(spacing: 20) {
                                Text("NO RECENT EXPENSES")
                                    .font(.system(size: 15, weight: .medium, design: .rounded))
                                    .foregroundColor(Color.SubtitleText)

                                Link(destination: URL(string: AppIdentifiers.urlScheme + "newExpense")!) {
                                    HStack(spacing: 4) {
                                        Image(systemName: "plus")
                                            .font(.system(size: 13, weight: .semibold, design: .rounded))

                                        Text("New Expense")
                                            .font(.system(size: 16, weight: .semibold, design: .rounded))
                                            .foregroundColor(Color.PrimaryText)
                                    }
                                    .padding(.vertical, 6)
                                    .frame(width: 200)
                                    .background(RoundedRectangle(cornerRadius: 9, style: .continuous).fill(Color.SecondaryBackground))
                                }
                            }
                            .frame(maxHeight: .infinity)

                        } else {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("RECENT EXPENSES")
                                    .font(.system(size: 12, weight: .medium, design: .rounded))
                                    .foregroundColor(Color.SubtitleText)

                                ForEach(entry.transactions, id: \.self) { transaction in
                                    HStack(spacing: 8) {
                                        RoundedRectangle(cornerRadius: 5)
                                            .fill(Color(hex: transaction.color))
                                            .frame(width: 15, height: 15)

                                        Text(transaction.note)
                                            .lineLimit(1)
                                            .font(.system(size: 16, weight: .medium, design: .rounded))
                                            .foregroundColor(Color.PrimaryText)
                                            .frame(maxWidth: .infinity, alignment: .leading)

                                        if transaction.income {
                                            Text("+\(currencySymbol)\(transaction.amount, specifier: (showCents && transaction.amount < 100) ? "%.2f" : "%.0f")")
                                                .font(.system(size: 16, weight: .regular, design: .rounded))
                                                .foregroundColor(Color.IncomeGreen)
                                                .lineLimit(1)
                                                .layoutPriority(1)
                                        } else {
                                            Text("-\(currencySymbol)\(transaction.amount, specifier: (showCents && transaction.amount < 100) ? "%.2f" : "%.0f")")
                                                .font(.system(size: 16, weight: .regular, design: .rounded))
                                                .foregroundColor(Color.SubtitleText)
                                                .lineLimit(1)
                                                .layoutPriority(1)
                                        }
                                    }
                                }

                                if entry.transactions.count < 5 {
                                    Link(destination: URL(string: AppIdentifiers.urlScheme + "newExpense")!) {
                                        HStack(spacing: 4) {
                                            Image(systemName: "plus")
                                                .font(.system(size: 13, weight: .semibold, design: .rounded))

                                            Text("New Expense")
                                                .font(.system(size: 16, weight: .semibold, design: .rounded))
                                                .foregroundColor(Color.PrimaryText)
                                        }
                                        .padding(.vertical, 6)
                                        .frame(width: 200)
                                        .background(RoundedRectangle(cornerRadius: 9, style: .continuous).fill(Color.SecondaryBackground))
                                    }
                                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                                }
                            }
                            .frame(maxHeight: .infinity, alignment: .top)
                        }
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .containerBackground(for: .widget) {
                    Color.PrimaryBackground
                }

        default:
            EmptyView()
        }
    }

    func getRectangularWidgetFont(width: CGFloat) -> CGFloat {
        var fontSize = 15.0

        while fontSize > 12 {
            var max = 0.0
            entry.transactions.forEach { transaction in
                let amountText: String
                if showCents && transaction.amount < 100 {
                    amountText = currencySymbol + String(format: "%.2f", transaction.amount)
                } else {
                    amountText = currencySymbol + String(format: "%.0f", transaction.amount)
                }

                let holding = transaction.note.widthOfRoundedString(size: fontSize, weight: .semibold) + amountText.widthOfRoundedString(size: fontSize, weight: .regular) + 8

                if holding > max {
                    max = holding
                }
            }

            if width > max {
                return fontSize
            }

            fontSize -= 1
        }

        return 12
    }
}
