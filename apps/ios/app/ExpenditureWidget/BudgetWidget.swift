//
//  BudgetWidget.swift
//  Outlayr
//
//  Created by Rafael Soh on 17/8/22.
//

import AppIntents
import SwiftUI
import WidgetKit

struct BudgetWidget: Widget {
    let kind: String = "BudgetWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: BudgetWidgetConfiguration.self, provider: BudgetWidgetProvider()) { entry in
            BudgetWidgetEntryView(entry: entry)
                .guardedByDataStore()
        }
        .configurationDisplayName("Budget")
        .description("Monitor how you are sticking to your budgets.")
        .supportedFamilies([.systemSmall])
    }
}

struct BudgetWidgetConfiguration: WidgetConfigurationIntent, CustomIntentMigratedAppIntent {
    // Existing widgets (BudgetWidget and LockBudgetWidget share this intent)
    // were configured through the SiriKit BudgetWidgetConfigurationIntent; the
    // system migrates their stored parameters onto this intent by matching this
    // class name plus the parameter name and type below, so none of them may
    // change.
    static let intentClassName = "BudgetWidgetConfigurationIntent"

    static var title: LocalizedStringResource = "Budget Widget Configuration"

    @Parameter(title: "Budget")
    var budget: WidgetBudgetEntity?
}

struct WidgetBudgetEntity: AppEntity, Identifiable {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = .init(name: "Budget")
    static var defaultQuery: WidgetBudgetQuery = .init()

    /// The budget's objectID URI string — the same identifier the SiriKit
    /// WidgetBudget INObject stored and `getWidgetSnapshot(identifier:)`
    /// parses — so migrated configurations keep resolving to the same budget.
    var id: String
    var name: String

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(name)")
    }
}

struct WidgetBudgetQuery: EntityQuery {
    func entities(for identifiers: [WidgetBudgetEntity.ID]) async throws -> [WidgetBudgetEntity] {
        guard DataController.storeIsAvailable else {
            // Broken app group: resolve to nothing instead of touching the store.
            return []
        }

        return await DataController.shared.budgets.getWidgetBudgetOptions()
            .filter { identifiers.contains($0.identifier) }
            .map { WidgetBudgetEntity(id: $0.identifier, name: $0.name) }
    }

    func suggestedEntities() async throws -> [WidgetBudgetEntity] {
        guard DataController.storeIsAvailable else {
            // Broken app group: fail the options request instead of returning an
            // empty budget list that looks like the user has no budgets.
            throw DataController.appGroupUnavailableError
        }

        return await DataController.shared.budgets.getWidgetBudgetOptions().map {
            WidgetBudgetEntity(id: $0.identifier, name: $0.name)
        }
    }
}

struct BudgetWidgetProvider: AppIntentTimelineProvider {
    typealias Intent = BudgetWidgetConfiguration

    public typealias Entry = BudgetWidgetEntry

    func placeholder(in _: Context) -> BudgetWidgetEntry {
        // Placeholder must return synchronously, so it skips the store read. A
        // fresh configuration has no budget, so the entry view renders its
        // select-a-budget message.
        BudgetWidgetEntry(date: Date(), totalSpent: 0, percentageOfDays: 0, budget: .failed, configuration: BudgetWidgetConfiguration())
    }

    func snapshot(for configuration: BudgetWidgetConfiguration, in context: Context) async -> BudgetWidgetEntry {
        if context.isPreview {
            return placeholder(in: context)
        }

        return await entry(for: configuration)
    }

    func timeline(for configuration: BudgetWidgetConfiguration, in _: Context) async -> Timeline<BudgetWidgetEntry> {
        Timeline(entries: [await entry(for: configuration)], policy: .atEnd)
    }

    private func entry(for configuration: BudgetWidgetConfiguration) async -> BudgetWidgetEntry {
        let loaded = await loadData(budgetId: configuration.budget?.id ?? "")

        return BudgetWidgetEntry(date: Date(), totalSpent: loaded.total, percentageOfDays: loaded.percentage, budget: loaded.budget, configuration: configuration)
    }

    func loadData(budgetId: String) async -> (total: Double, percentage: Double, budget: HoldingBudget) {
        guard DataController.storeIsAvailable else {
            // Broken app group: do not touch the store. The entry view shows the
            // error placeholder via `guardedByDataStore()`.
            return (0, 0, HoldingBudget.failed)
        }

        let snapshot: BudgetRepository.WidgetSnapshot

        do {
            snapshot = try await DataController.shared.budgets.getWidgetSnapshot(identifier: budgetId)
        } catch {
            // Unconfigured or since-deleted budget renders as the missing-budget entry.
            return (0, 0, HoldingBudget.failed)
        }

        let returnBudget = HoldingBudget(type: snapshot.type, symbol: snapshot.symbol, name: snapshot.name, color: snapshot.color, budgetAmount: snapshot.budgetAmount)

        let percentageOfDays: Double

        let calendar = Calendar.current

        if snapshot.type == 1 {
            let components = calendar.dateComponents([.minute], from: snapshot.startDate, to: Date.now)
            percentageOfDays = Double(components.minute ?? 0) / 1440
        } else {
            let components1 = calendar.dateComponents([.day], from: snapshot.startDate, to: snapshot.endDate)
            let numberOfDays = components1.day ?? 0

            let components2 = calendar.dateComponents([.day], from: snapshot.startDate, to: Date.now)
            let numberOfDaysPast = components2.day ?? 0

            percentageOfDays = numberOfDays > 0 ? Double(numberOfDaysPast) / Double(numberOfDays) : 0
        }

        return (snapshot.totalSpent, percentageOfDays, returnBudget)
    }
}

struct BudgetWidgetEntry: TimelineEntry {
    let date: Date
    let totalSpent: Double
    let percentageOfDays: Double
    let budget: HoldingBudget
    let configuration: BudgetWidgetConfiguration
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
                                            .fill(Color(hex: entry.budget.color))
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
