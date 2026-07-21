//
//  LockBudgetWidget.swift
//  ExpenditureWidgetExtension
//
//  Created by Rafael Soh on 9/9/22.
//

import SwiftUI
import WidgetKit

struct LockBudgetWidget: Widget {
    let kind: String = "LockBudgetWidget"

    private var supportedFamilies: [WidgetFamily] {
        if #available(iOSApplicationExtension 16, *) {
            return [
                .accessoryCircular,
                .accessoryRectangular,
                .accessoryInline
            ]
        } else {
            return [WidgetFamily]()
        }
    }

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: BudgetWidgetConfiguration.self, provider: LockBudgetWidgetProvider()) { entry in
            LockBudgetWidgetEntryView(entry: entry)
                .guardedByDataStore()
        }
        .configurationDisplayName("Budget")
        .description("Monitor how you are sticking to your budgets.")
        .supportedFamilies(supportedFamilies)
    }
}

struct LockBudgetWidgetProvider: AppIntentTimelineProvider {
    typealias Intent = BudgetWidgetConfiguration

    public typealias Entry = LockBudgetWidgetEntry

    func placeholder(in _: Context) -> LockBudgetWidgetEntry {
        // Placeholder must return synchronously, so it skips the store read. A
        // fresh configuration has no budget, so the entry view renders its
        // select-a-budget message.
        LockBudgetWidgetEntry(date: Date(), totalSpent: 0, timeLeft: "", budget: .failed, configuration: BudgetWidgetConfiguration())
    }

    func snapshot(for configuration: BudgetWidgetConfiguration, in context: Context) async -> LockBudgetWidgetEntry {
        if context.isPreview {
            return placeholder(in: context)
        }

        return await entry(for: configuration)
    }

    func timeline(for configuration: BudgetWidgetConfiguration, in _: Context) async -> Timeline<LockBudgetWidgetEntry> {
        Timeline(entries: [await entry(for: configuration)], policy: .atEnd)
    }

    private func entry(for configuration: BudgetWidgetConfiguration) async -> LockBudgetWidgetEntry {
        let loaded = await loadData(budgetId: configuration.budget?.id ?? "")

        return LockBudgetWidgetEntry(date: Date(), totalSpent: loaded.total, timeLeft: loaded.timeLeft, budget: loaded.budget, configuration: configuration)
    }

    func loadData(budgetId: String) async -> (total: Double, timeLeft: String, budget: HoldingBudget) {
        guard DataController.storeIsAvailable else {
            // Broken app group: do not touch the store. The entry view shows the
            // error placeholder via `guardedByDataStore()`.
            return (0, "", HoldingBudget.failed)
        }

        let snapshot: BudgetRepository.WidgetSnapshot

        do {
            snapshot = try await DataController.shared.budgets.getWidgetSnapshot(identifier: budgetId)
        } catch {
            // Unconfigured or since-deleted budget renders as the missing-budget entry.
            return (0, "", HoldingBudget.failed)
        }

        let returnBudget = HoldingBudget(type: snapshot.type, symbol: snapshot.symbol, name: snapshot.name, color: snapshot.color, budgetAmount: snapshot.budgetAmount)

        let timeLeft: String

        let calendar = Calendar.current

        if snapshot.type == 1 {
            let components = calendar.dateComponents([.hour], from: snapshot.startDate, to: Date.now)

            timeLeft = String(localized: "\(24 - components.hour!) hours left")
        } else if snapshot.type == 2 {
            let components = calendar.dateComponents([.day], from: snapshot.startDate, to: Date.now)

            timeLeft = String(localized: "\(7 - components.day!) days left")
        } else {
            let components1 = calendar.dateComponents([.day], from: snapshot.startDate, to: snapshot.endDate)
            let numberOfDays = components1.day!

            let components2 = calendar.dateComponents([.day], from: snapshot.startDate, to: Date.now)
            let numberOfDaysPast = components2.day!

            let daysLeftNumber = Int(numberOfDays - numberOfDaysPast)
            timeLeft = String(localized: "\(daysLeftNumber) days left")
        }

        return (snapshot.totalSpent, timeLeft, returnBudget)
    }
}

struct LockBudgetWidgetEntry: TimelineEntry {
    let date: Date
    let totalSpent: Double
    let timeLeft: String
    let budget: HoldingBudget
    let configuration: BudgetWidgetConfiguration
}

struct LockBudgetWidgetEntryView: View {
    @Environment(\.widgetFamily) var widgetFamily
    let entry: LockBudgetWidgetProvider.Entry

    var budgetType: String {
        switch entry.budget.type {
        case 1:
            return String(localized: "today")
        case 2:
            return String(localized: "this week")
        case 3:
            return String(localized: "this month")
        case 4:
            return String(localized: "this year")
        default:
            return "this week"
        }
    }

    var subtitle: String {
        if entry.budget.budgetAmount > entry.totalSpent {
            return String(localized: "left")
        } else {
            return String(localized: "over")
        }
    }

    var difference: Double {
        return abs(entry.budget.budgetAmount - entry.totalSpent)
    }

    var percent: Double {
        return entry.totalSpent / entry.budget.budgetAmount
    }

    var percentString: String {
        return String(localized: "\(Int(round((entry.totalSpent / entry.budget.budgetAmount) * 100)))% spent")
    }

    @AppStorage("currency", store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency)!
    }

    @AppStorage("showCents", store: AppIdentifiers.sharedDefaults) var showCents: Bool = true

    var body: some View {
        switch widgetFamily {
        case .accessoryInline:
            if entry.configuration.budget == nil {
                Text("Select budget in widget options")
            } else if entry.budget.missing {
                Text("Budget no longer exists")
            } else {
                // accessoryInline renders plain system text only, so there is no
                // glyph here — the name is what tells two inline widgets apart.
                Text("\(entry.budget.name) \(currencySymbol)\(difference, specifier: (showCents && difference < 100) ? "%.2f" : "%.0f") \(subtitle)")
                    .widgetURL(URL(string: AppIdentifiers.urlScheme + "budget?budget=\(entry.budget.name)"))
            }

        case .accessoryCircular:
                if entry.configuration.budget == nil {
                    ZStack {
                        AccessoryWidgetBackground()

                        Text("SELECT BUDGET")
                            .font(.system(size: 8, weight: .semibold, design: .rounded))
                            .frame(maxWidth: .infinity)
                            .multilineTextAlignment(.center)
                    }
                    .containerBackground(for: .widget) { AccessoryWidgetBackground() }
                } else if entry.budget.missing {
                    ZStack {
                        AccessoryWidgetBackground()

                        Text("NO BUDGET")
                            .font(.system(size: 8, weight: .semibold, design: .rounded))
                            .frame(maxWidth: .infinity)
                            .multilineTextAlignment(.center)
                    }
                    .containerBackground(for: .widget) { AccessoryWidgetBackground() }
                } else {
                    Gauge(value: percent < 1 ? percent : 1) {
                        WidgetSymbolGlyph(symbol: entry.budget.symbol, size: 11)
                    } currentValueLabel: {
                        Text("\(Int(round(percent * 100)))%")
                    }
                    .gaugeStyle(AccessoryCircularGaugeStyle())
                    .widgetURL(URL(string: AppIdentifiers.urlScheme + "budget?budget=\(entry.budget.name)"))
                    .containerBackground(for: .widget) { Color.clear }
                }

        case .accessoryRectangular:
                if entry.configuration.budget == nil {
                    Text("SELECT BUDGET IN WIDGET OPTIONS")
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .frame(maxWidth: .infinity)
                        .multilineTextAlignment(.center)
                        .containerBackground(for: .widget) { Color.clear }
                } else if entry.budget.missing {
                    Text("BUDGET NO LONGER EXISTS - SELECT NEW BUDGET IN WIDGET OPTIONS")
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .frame(maxWidth: .infinity)
                        .multilineTextAlignment(.center)
                        .containerBackground(for: .widget) { Color.clear }
                } else {
                    GeometryReader { proxy in
                        VStack(alignment: .leading) {
                            HStack(spacing: 3) {
                                Text(entry.budget.name)

                                if showPercent(size: proxy.size.width) {
                                    Text("•")
                                    Text(percentString)
                                }
                            }
                            .font(.system(size: 15, weight: .semibold, design: .rounded))

                            Text("\(currencySymbol)\(difference, specifier: (showCents && difference < 100) ? "%.2f" : "%.0f") \(subtitle) \(budgetType)")
                                .font(.system(size: 14, weight: .regular, design: .rounded))
                                .foregroundColor(Color.SubtitleText)

                            Gauge(value: percent, in: 0 ... 1) {
                                Text("Percent Spent")
                            } currentValueLabel: {
                                EmptyView()
                            } minimumValueLabel: {
                                Text("\(entry.totalSpent, specifier: (showCents && entry.totalSpent < 100) ? "%.2f" : "%.0f")")
                                    .font(.system(size: 10, weight: .regular, design: .rounded))
                            } maximumValueLabel: {
                                Text("\(entry.budget.budgetAmount, specifier: (showCents && entry.budget.budgetAmount < 100) ? "%.2f" : "%.0f")")
                                    .font(.system(size: 10, weight: .regular, design: .rounded))
                            }
                            .frame(height: 5)
                            .gaugeStyle(.accessoryLinear)
                        }
                        .frame(width: proxy.size.width, height: proxy.size.height, alignment: .top)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .widgetURL(URL(string: AppIdentifiers.urlScheme + "budget?budget=\(entry.budget.name)"))
                    .containerBackground(for: .widget) { Color.clear }
                }

        default:
            EmptyView()
        }
    }

    func showPercent(size: CGFloat) -> Bool {
        return size > entry.budget.name.widthOfRoundedString(size: 15, weight: .semibold) + 15 + percentString.widthOfRoundedString(size: 15, weight: .semibold)
    }
}
