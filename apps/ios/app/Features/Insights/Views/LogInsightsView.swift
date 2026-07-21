//
//  LogInsightsView.swift
//  Outlayr

import CoreData
import Foundation
import Popovers
import SwiftUI

struct LogInsightsView: View {
    @Environment(DataController.self) private var dataController
    @Environment(\.dynamicTypeSize) var dynamicTypeSize

    @Binding var navBarText: String

    let showCents: Bool
    let currencySymbol: String

    @State var showMenu1 = false
    let subtitleText = ["today", "this week", "this month", "this year", "all time"]

    @AppStorage(DefaultsKey.logInsightsTimeFrame, store: AppIdentifiers.sharedDefaults) var timeframe = 2
    @AppStorage(DefaultsKey.logInsightsType, store: AppIdentifiers.sharedDefaults) var insightsType = 1

    @AppStorage(DefaultsKey.logViewLineGraph, store: AppIdentifiers.sharedDefaults) var lineGraph: Bool = false

    @State private var netTotal: (value: Double, positive: Bool) = (0, true)
    @State private var totalSpent: Double = 0
    @State private var totalIncome: Double = 0
    @State private var lineGraphData: [LineGraphDataPoint] = []

    var range: Int {
        var calendar = Calendar(identifier: .gregorian)

        calendar.firstWeekday = AppIdentifiers.sharedDefaults?.integer(forKey: "firstWeekday") ?? 0
        calendar.minimumDaysInFirstWeek = 4

        if timeframe == 3 {
            let dateComponents = calendar.dateComponents([.month, .year], from: Date.now)

            let thisMonth = calendar.date(from: dateComponents) ?? Date.now
            let numberOfDays = calendar.dateComponents([.day], from: thisMonth, to: Date.now)

            return (numberOfDays.day ?? 0) + 1
        } else if timeframe == 4 {
            let dateComponents = calendar.dateComponents([.year], from: Date.now)

            let thisYear = calendar.date(from: dateComponents) ?? Date.now

            let numberOfMonths = calendar.dateComponents([.month], from: thisYear, to: Date.now)

            return (numberOfMonths.month ?? 0) + 1
        } else {
            let dateComponents = calendar.dateComponents([.weekOfYear, .yearForWeekOfYear], from: Date.now)
            let thisWeek = calendar.date(from: dateComponents) ?? Date.now
            let numberOfDays = calendar.dateComponents([.day], from: thisWeek, to: Date.now)

            return (numberOfDays.day ?? 0) + 1
        }
    }

    var lineGraphGreen: Bool {
        if insightsType == 1 {
            return (lineGraphData.first?.amount ?? 0.0) < (lineGraphData.last?.amount ?? 0.0)
        } else if insightsType == 2 {
            return true
        } else {
            return false
        }
    }

    var amount: Double {
        if insightsType == 1 {
            return netTotal.value
        } else if insightsType == 2 {
            return totalIncome
        } else {
            return totalSpent
        }
    }

    var headingText: String {
        if insightsType == 1 {
            return "Net total"
        } else if insightsType == 2 {
            return "Earned"
        } else {
            return "Spent"
        }
    }

    var body: some View {
        VStack(spacing: -3) {
            VStack(spacing: 2) {
                HStack(spacing: 4) {
                    Text(LocalizedStringKey(headingText))
                        .font(.system(.body, design: .rounded).weight(.medium))
                        .foregroundStyle(Color.PrimaryText.opacity(0.9))
                    Button {
                        showMenu1 = true
                    } label: {
                        Text(LocalizedStringKey(subtitleText[timeframe - 1]))
                            .padding(2)
                            .padding(.horizontal, 6)
                            .font(.system(.body, design: .rounded).weight(.medium))
                            .foregroundStyle(Color.PrimaryText.opacity(9))
                            .overlay(Capsule().stroke(Color.Outline, lineWidth: 1.3))
                    }
                    .popover(present: $showMenu1, attributes: {
                        $0.position = .absolute(
                            originAnchor: .bottom,
                            popoverAnchor: .top
                        )
                        $0.rubberBandingMode = .none
                        $0.sourceFrameInset = UIEdgeInsets(top: 0, left: 0, bottom: -10, right: 0)
                        $0.presentation.animation = .easeInOut(duration: 0.2)
                        $0.dismissal.animation = .easeInOut(duration: 0.3)
                    }) {
                        TimePickerView(showMenu: $showMenu1, timeframe: $timeframe)
                    }
                }

                EmptyView()
                    .modifier(NumberView(number: amount, dynamicTypeSize: _dynamicTypeSize.wrappedValue, netTotal: insightsType == 1, positive: netTotal.positive))
            }
            .padding(7)
            .contentShape(Rectangle())
            .contextMenu {
                if insightsType != 3 {
                    Button {
                        insightsType = 3
                    } label: {
                        Label("Total Spent", systemImage: "minus")
                    }
                }

                if insightsType != 2 {
                    Button {
                        insightsType = 2
                    } label: {
                        Label("Total Income", systemImage: "plus")
                    }
                }

                if insightsType != 1 {
                    Button {
                        insightsType = 1
                    } label: {
                        Label("Net Total", systemImage: "alternatingcurrent")
                    }
                }
            }

            if totalSpent != 0 && totalIncome != 0 && insightsType == 1 {
                HStack {
//                    if showCents {
//                        Text("+\(totalIncome, specifier: "%.2f")")
//                            .font(.system(size: 18, weight: .medium, design: .rounded))
//                            .foregroundStyle(Color.IncomeGreen)
//                            .lineLimit(1)
//                    } else {
//                        Text("+\(Int(floor(totalIncome)))")
//                            .font(.system(size: 18, weight: .medium, design: .rounded))
//                            .foregroundStyle(Color.IncomeGreen)
//                            .lineLimit(1)
//                    }

                    Text("+\(formatNumber(showCents: showCents, number: totalIncome))")
                        .font(.system(.title2, design: .rounded).weight(.medium))
                        .minimumScaleFactor(0.5)
//                        .font(.system(size: 18, weight: .medium, design: .rounded))
                        .foregroundStyle(Color.IncomeGreen)
                        .lineLimit(1)

                    DottedLine()
                        .stroke(style: StrokeStyle(lineWidth: 1.7, lineCap: .round))
                        .frame(width: 1.7, height: 15)
                        .foregroundStyle(Color.Outline)

                    Text("-\(formatNumber(showCents: showCents, number: totalSpent))")
                        .font(.system(.title2, design: .rounded).weight(.medium))
                        .minimumScaleFactor(0.5)
//                        .font(.system(size: 18, weight: .medium, design: .rounded))
                        .foregroundStyle(Color.AlertRed)
                        .lineLimit(1)

//                    if showCents {
//                        Text("-\(totalSpent, specifier: "%.2f")")
//                            .font(.system(size: 18, weight: .medium, design: .rounded))
//                            .foregroundStyle(Color.AlertRed)
//                            .lineLimit(1)
//                    } else {
//                        Text("-\(Int(floor(totalSpent)))")
//                            .font(.system(size: 18, weight: .medium, design: .rounded))
//                            .foregroundStyle(Color.AlertRed)
//                            .lineLimit(1)
//                    }
                }
                .padding(.bottom, 13)
            }

            if lineGraph {
                LineGraph(data: lineGraphData, green: lineGraphGreen, type: timeframe, range: range)
                    .frame(height: 25)
                    .padding(.horizontal, 60)
                    .padding(.top, 16)
            }
        }
        .padding([.bottom, .horizontal], 20)
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .frame(height: lineGraph ? 240 : 170)
        .task(id: [timeframe, insightsType]) {
            // Capture the selection once: a cancelled-but-still-running load must
            // never pick up a newer selection mid-flight.
            let timeframe = timeframe
            let insightsType = insightsType

            // Subscribe before the initial load so a save landing mid-load still
            // triggers a refresh. No object filter: CloudKit imports save the
            // mirroring delegate's own background context, and the view context
            // only merges those changes without posting didSave itself.
            let saves = NotificationCenter.default.notifications(named: .NSManagedObjectContextDidSave)

            await loadInsights(timeframe: timeframe, insightsType: insightsType)

            // Reload whenever any context saves (edits, deletes, CloudKit imports);
            // the values are @State, so nothing recomputes on its own.
            for await _ in saves {
                guard !Task.isCancelled else { return }
                await loadInsights(timeframe: timeframe, insightsType: insightsType)
            }
        }
    }

    private func loadInsights(timeframe: Int, insightsType: Int) async {
        let insights = await dataController.transactions.getLogViewInsights(type: timeframe, insightsType: insightsType)

        guard !Task.isCancelled else { return }

        netTotal = (insights.netTotal, insights.isNetPositive)
        totalSpent = insights.totalSpent
        totalIncome = insights.totalIncome
        lineGraphData = insights.lineGraphData
    }

    func formatNumber(showCents: Bool, number: Double) -> String {
        if showCents {
            return String(format: "%.2f", number)
        } else {
            return String(format: "%d", Int(floor(number)))
        }
    }
}
