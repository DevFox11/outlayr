//
//  BudgetWidget.swift
//  Outlayr
//
//  Created by Rafael Soh on 17/8/22.
//

import SwiftUI
import WidgetKit

struct BudgetWidget: Widget {
    let kind: String = "BudgetWidget"

    var body: some WidgetConfiguration {
        IntentConfiguration(kind: kind, intent: BudgetWidgetConfigurationIntent.self, provider: BudgetWidgetProvider()) { entry in
            BudgetWidgetEntryView(entry: entry)
                .guardedByDataStore()
        }
        .configurationDisplayName("Budget")
        .description("Monitor how you are sticking to your budgets.")
        .supportedFamilies([.systemSmall])
    }
}

struct BudgetWidgetProvider: IntentTimelineProvider {
    typealias Intent = BudgetWidgetConfigurationIntent

    public typealias Entry = BudgetWidgetEntry

    func placeholder(in _: Context) -> BudgetWidgetEntry {
        let loaded = loadData(budgetId: "")

        return BudgetWidgetEntry(date: Date(), totalSpent: loaded.total, percentageOfDays: loaded.percentage, budget: loaded.budget, configuration: BudgetWidgetConfigurationIntent())
    }

    func getSnapshot(for configuration: BudgetWidgetConfigurationIntent, in _: Context, completion: @escaping (BudgetWidgetEntry) -> Void) {
        let loaded = loadData(budgetId: configuration.budget?.identifier ?? "")

        let entry = BudgetWidgetEntry(date: Date(), totalSpent: loaded.total, percentageOfDays: loaded.percentage, budget: loaded.budget, configuration: configuration)
        completion(entry)
    }

    func getTimeline(for configuration: BudgetWidgetConfigurationIntent, in _: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        let loaded = loadData(budgetId: configuration.budget?.identifier ?? "")

        let entry = BudgetWidgetEntry(date: Date(), totalSpent: loaded.total, percentageOfDays: loaded.percentage, budget: loaded.budget, configuration: configuration)

        let timeline = Timeline(entries: [entry], policy: .atEnd)

        completion(timeline)
    }

    func loadData(budgetId: String) -> (total: Double, percentage: Double, budget: HoldingBudget) {
        guard DataController.storeIsAvailable else {
            // Broken app group: do not touch the store (avoids a crash on the
            // force-unwrapped objectID lookup). The entry view shows the error
            // placeholder via `guardedByDataStore()`.
            return (0, 0, HoldingBudget.failed)
        }

//        let dataController = DataController()
        let dataController = DataController.shared

        if let objectIDURL = URL(string: budgetId) {
            let managedObjectID = dataController.container.persistentStoreCoordinator.managedObjectID(forURIRepresentation: objectIDURL)!

            let budget = dataController.container.viewContext.object(with: managedObjectID) as! Budget

            let fetchRequest = dataController.budgets.fetchRequestForBudgetTransactions(budget: budget)

            let transactions = dataController.results(for: fetchRequest)

            var holdingTotal = 0.0

            transactions.forEach { transaction in
                holdingTotal += transaction.wrappedAmount
            }

            let returnBudget = HoldingBudget(type: Int(budget.type), symbol: budget.displaySymbol, name: budget.wrappedName, colour: budget.wrappedColour, budgetAmount: budget.amount)

            let percentageOfDays: Double

            let calendar = Calendar.current

            if budget.type == 1 {
                let components = calendar.dateComponents([.minute], from: budget.startDate!, to: Date.now)
                percentageOfDays = Double(components.minute!) / 1440
            } else {
                let components1 = calendar.dateComponents([.day], from: budget.startDate!, to: budget.endDate)
                let numberOfDays = components1.day!

                let components2 = calendar.dateComponents([.day], from: budget.startDate!, to: Date.now)
                let numberOfDaysPast = components2.day!

                percentageOfDays = Double(numberOfDaysPast) / Double(numberOfDays)
            }

            return (holdingTotal, percentageOfDays, returnBudget)
        } else {
            let budget = HoldingBudget.failed
            return (0, 0, budget)
        }
    }
}

struct BudgetWidgetEntry: TimelineEntry {
    let date: Date
    let totalSpent: Double
    let percentageOfDays: Double
    let budget: HoldingBudget
    let configuration: BudgetWidgetConfigurationIntent
}

struct BudgetWidgetEntryView: View {
    let entry: BudgetWidgetProvider.Entry

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

    var difference: Double {
        return abs(entry.budget.budgetAmount - entry.totalSpent)
    }

    var percentString1: String {
        return "\(Int(round((entry.totalSpent / entry.budget.budgetAmount) * 100)))%"
    }

    var systemSmallWidgetText: String {
        if entry.budget.budgetAmount >= entry.totalSpent {
            return String(localized: "left \(budgetType)")
        } else {
            return String(localized: "over \(budgetType)")
        }
    }

    func showTimeFrame(size: CGFloat) -> Bool {
        return size > systemSmallWidgetText.widthOfRoundedString(size: 10, weight: .semibold)
    }

    var body: some View {
        if entry.configuration.budget == nil {
                Text("Select budget in widget options")
                    .font(.system(size: 14, weight: .medium, design: .rounded))
                    .multilineTextAlignment(.center)
                    .foregroundColor(Color.SubtitleText)
                    .padding(15)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .containerBackground(for: .widget) {
                        Color.PrimaryBackground
                    }

        } else if entry.budget.missing {
                Text("Budget no longer exists - please select new budget from widget options.")
                    .font(.system(size: 14, weight: .medium, design: .rounded))
                    .multilineTextAlignment(.center)
                    .foregroundColor(Color.SubtitleText)
                    .padding(15)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .containerBackground(for: .widget) {
                        Color.PrimaryBackground
                    }

        } else {
                VStack(spacing: 12) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 2.4) {
                            HStack(spacing: 5) {
                                WidgetSymbolGlyph(
                                    symbol: entry.budget.symbol,
                                    size: 10,
                                    color: Color.PrimaryText
                                )
                                Text(entry.budget.name.uppercased())
                                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                                    .lineLimit(1)
                            }
                            .foregroundColor(Color.PrimaryText)

                            Text("SPENT: \(percentString1)")
                                .font(.system(size: 10, weight: .medium, design: .rounded))
                                .foregroundColor(Color.SubtitleText)
                        }

                        Spacer()

                        RingView(percent: entry.percentageOfDays, width: 2.4, topStroke: Color.DarkBackground, bottomStroke: Color.SecondaryBackground)
                            .frame(width: 13, height: 13)
                            .padding(3)
                    }
                    .frame(maxWidth: .infinity)

                    GeometryReader { proxy in
                        VStack(spacing: 6) {
                            ZStack(alignment: .bottom) {
                                ZStack {
                                    DonutSemicircle(percent: 1, cornerRadius: 4, width: 15)
                                        .fill(Color.SecondaryBackground)
                                        .frame(width: proxy.size.width, height: proxy.size.width / 2)

                                    if entry.totalSpent / entry.budget.budgetAmount < 0.97 {
                                        DonutSemicircle(percent: 1 - (entry.totalSpent / entry.budget.budgetAmount), cornerRadius: 4, width: 15)
                                            .fill(Color(hex: entry.budget.colour))
                                            .frame(width: proxy.size.width, height: proxy.size.width / 2)
                                    }
                                }
                                .frame(width: proxy.size.width)

                                VStack(spacing: -4) {
                                    WidgetBudgetDollarView(amount: difference, red: entry.totalSpent >= entry.budget.budgetAmount)
                                        .frame(width: proxy.size.width - 50)

                                    if showTimeFrame(size: proxy.size.width - 50) {
                                        Text(systemSmallWidgetText)
                                            .font(.system(size: 10, weight: .medium, design: .rounded))
                                            .foregroundColor(Color.SubtitleText)
                                    } else {
                                        if entry.budget.budgetAmount >= entry.totalSpent {
                                            Text("left")
                                                .font(.system(size: 10, weight: .medium, design: .rounded))
                                                .foregroundColor(Color.SubtitleText)
                                        } else {
                                            Text("over")
                                                .font(.system(size: 10, weight: .medium, design: .rounded))
                                                .foregroundColor(Color.SubtitleText)
                                        }
                                    }
                                }
                            }
                            .frame(width: proxy.size.width)

                            HStack {
                                if entry.totalSpent > 999.99 || entry.budget.budgetAmount > 999.99 {
                                    Text("\(Int(round(entry.totalSpent)))")
                                        .frame(width: 50, alignment: .leading)
                                    Spacer()
                                    Text("\(Int(round(entry.budget.budgetAmount)))")
                                        .frame(width: 50, alignment: .trailing)
                                } else {
                                    Text("\(entry.totalSpent, specifier: "%.2f")")
                                        .frame(width: 50, alignment: .leading)
                                    Spacer()
                                    Text("\(entry.budget.budgetAmount, specifier: "%.2f")")
                                        .frame(width: 50, alignment: .trailing)
                                }
                            }
                            .font(.system(size: 10, weight: .medium, design: .rounded))
                            .foregroundColor(Color.SubtitleText)
                        }
                        .frame(width: proxy.size.width, height: proxy.size.height, alignment: .bottom)
                    }
                    .frame(maxHeight: .infinity, alignment: .bottom)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .containerBackground(for: .widget) {
                    Color.PrimaryBackground
                }
                .widgetURL(URL(string: AppIdentifiers.urlScheme + "budget?budget=\(entry.budget.name)"))
        }
    }
}
