//
//  LogInsightsView.swift
//  Outlayr

import CoreData
import Foundation
import SwiftUI

/// The Log's ledger head: one promoted figure, the two it isn't, and every
/// other currency the period holds listed beside them rather than folded into
/// them. Nothing here does currency arithmetic — the repository buckets, and
/// this view picks a bucket and renders it.
struct LogInsightsView: View {
    @Environment(DataController.self) private var dataController
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    let showCents: Bool

    @AppStorage(DefaultsKey.logInsightsTimeFrame, store: AppIdentifiers.sharedDefaults) private var timeframe = 2
    @AppStorage(DefaultsKey.logInsightsType, store: AppIdentifiers.sharedDefaults) private var insightsType = 1
    @AppStorage(DefaultsKey.logViewLineGraph, store: AppIdentifiers.sharedDefaults) private var lineGraph: Bool = false

    @State private var insights: TransactionRepository.LogViewInsights?
    /// Nil means "whichever currency the period leads with". A scope is only
    /// pinned by choosing one, and the pin is dropped once that currency stops
    /// appearing in the period.
    @State private var scopeCurrency: String?

    private var measure: LogMeasure { LogMeasure(storedValue: insightsType) }
    private var period: LogPeriod { LogPeriod(storedValue: timeframe) }

    private var figures: TransactionRepository.LogViewInsights.Figures? {
        guard let insights else { return nil }
        guard let scopeCurrency else { return insights.dominant }
        return insights.figures(for: scopeCurrency) ?? insights.dominant
    }

    /// Every currency the period holds that the hero is not currently showing.
    private var alsoThisPeriod: [TransactionRepository.LogViewInsights.Figures] {
        guard let insights, let figures else { return [] }
        return insights.perCurrency.filter { $0.currencyCode != figures.currencyCode }
    }

    var range: Int {
        var calendar = Calendar(identifier: .gregorian)

        calendar.firstWeekday = AppIdentifiers.sharedDefaults?.integer(forKey: DefaultsKey.firstWeekday) ?? 0
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

    private var lineGraphData: [LineGraphDataPoint] { insights?.lineGraphData ?? [] }

    private var lineGraphGreen: Bool {
        measure.isTrendPositive(
            firstPoint: lineGraphData.first?.amount ?? 0,
            lastPoint: lineGraphData.last?.amount ?? 0
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            eyebrowRow

            hero

            measureCells

            if !alsoThisPeriod.isEmpty {
                alsoStrip
            }

            if lineGraph, lineGraphData.count > 1 {
                LineGraph(data: lineGraphData, green: lineGraphGreen, type: timeframe, range: range)
                    .frame(height: 34)
                    .padding(.top, 16)
                    .padding(.bottom, 4)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 20)
        .padding(.top, 14)
        .task(id: [timeframe, insightsType]) {
            // Capture the selection once: a cancelled-but-still-running load
            // must never pick up a newer selection mid-flight.
            let timeframe = timeframe
            let insightsType = insightsType

            // Subscribe before the initial load so a save landing mid-load
            // still triggers a refresh. No object filter: background contexts
            // save themselves and the view context only merges those changes
            // without posting didSave itself.
            let saves = NotificationCenter.default.notifications(named: .NSManagedObjectContextDidSave)

            await loadInsights(timeframe: timeframe, insightsType: insightsType)

            for await _ in saves {
                guard !Task.isCancelled else { return }
                await loadInsights(timeframe: timeframe, insightsType: insightsType)
            }
        }
    }

    private var eyebrow: some View {
        MonoLabel(
            Text(LocalizedStringKey(measure.titleKey))
                // Non-breaking before the middot so a wrap never orphans it.
                + Text(verbatim: "\u{00A0}· ")
                + Text(LocalizedStringKey(period.titleKey))
        )
        .fixedSize(horizontal: false, vertical: true)
    }

    /// Side by side at ordinary sizes, stacked once the tracked mono label and
    /// the chip can no longer share a line without one of them truncating.
    @ViewBuilder
    private var eyebrowRow: some View {
        if dynamicTypeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: 8) {
                eyebrow

                if let insights, insights.isMultiCurrency {
                    currencyScopeChip(insights: insights)
                }
            }
        } else {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                eyebrow

                Spacer(minLength: 0)

                if let insights, insights.isMultiCurrency {
                    currencyScopeChip(insights: insights)
                }
            }
        }
    }

    private var hero: some View {
        EmptyView()
            .modifier(NumberView(
                number: figures.map { measure.magnitude(in: $0) } ?? 0,
                dynamicTypeSize: dynamicTypeSize,
                positive: figures.map { measure.isPositive(in: $0) } ?? true,
                currencyCode: figures?.currencyCode
            ))
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 4)
    }

    @ViewBuilder
    private var measureCells: some View {
        let alternatives = measure.alternatives

        if let figures, alternatives.count == 2 {
            VStack(spacing: 0) {
                hairline

                // Two columns become two rows once a figure can no longer fit
                // beside another: a truncated amount is worse than a taller block.
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(spacing: 0) {
                        cell(alternatives[0], figures: figures)

                        cell(alternatives[1], figures: figures)
                            .overlay(alignment: .top) { hairline }
                    }
                } else {
                    HStack(spacing: 0) {
                        cell(alternatives[0], figures: figures)

                        cell(alternatives[1], figures: figures)
                            .padding(.leading, 14)
                            .overlay(alignment: .leading) {
                                Rectangle()
                                    .fill(Color.Outline)
                                    .frame(width: 1)
                            }
                    }
                }
            }
            .padding(.top, 12)
        }
    }

    private func cell(
        _ measure: LogMeasure,
        figures: TransactionRepository.LogViewInsights.Figures
    ) -> some View {
        LogMeasureCellView(measure: measure, figures: figures, showCents: showCents) {
            insightsType = measure.rawValue
        }
    }

    private var alsoStrip: some View {
        VStack(alignment: .leading, spacing: 8) {
            hairline
                .padding(.bottom, 3)

            MonoLabel(Text("Also") + Text(verbatim: " ") + Text(LocalizedStringKey(period.titleKey)))

            ViewThatFits(in: .horizontal) {
                HStack(spacing: 6) { alsoPills }

                VStack(alignment: .leading, spacing: 6) { alsoPills }
            }
        }
        .padding(.top, 12)
    }

    private var alsoPills: some View {
        ForEach(alsoThisPeriod) { entry in
            let formatter = CurrencyAmountFormatter(currencyCode: entry.currencyCode, showCents: showCents)
            let amount = formatter.signedString(
                magnitude: measure.magnitude(in: entry),
                isPositive: measure.isPositive(in: entry)
            )

            HStack(spacing: 6) {
                MonoLabel(verbatim: entry.currencyCode)

                Text(verbatim: amount)
                    .font(.system(.footnote, design: .rounded).weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(measure.isIncome ? Color.IncomeGreen : Color.PrimaryText)
                    .lineLimit(1)
            }
            .padding(.vertical, 4)
            .padding(.horizontal, 8)
            .background(Color.SecondaryBackground, in: RoundedRectangle(cornerRadius: 7, style: .continuous))
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(Text(verbatim: "\(entry.currencyCode), \(amount)"))
        }
    }

    private var hairline: some View {
        Rectangle()
            .fill(Color.Outline)
            .frame(height: 1)
            .frame(maxWidth: .infinity)
    }

    private func currencyScopeChip(insights: TransactionRepository.LogViewInsights) -> some View {
        Menu {
            Picker(selection: scopeSelection) {
                ForEach(insights.perCurrency) { entry in
                    Text(verbatim: entry.currencyCode).tag(entry.currencyCode)
                }
            } label: {
                Text("Currency")
            }
            .pickerStyle(.inline)
        } label: {
            HStack(spacing: 4) {
                MonoLabel(verbatim: figures?.currencyCode ?? insights.dominant.currencyCode, color: Color.PrimaryText)

                Image(systemName: "chevron.down")
                    .font(.system(.caption2, design: .rounded).weight(.bold))
                    .foregroundStyle(Color.SubtitleText)
            }
            .padding(.vertical, 4)
            .padding(.horizontal, 9)
            .background(Color.SecondaryBackground, in: Capsule())
            .contentShape(Capsule())
        }
        .accessibilityLabel("Currency shown")
        .accessibilityValue(Text(verbatim: figures?.currencyCode ?? insights.dominant.currencyCode))
    }

    private var scopeSelection: Binding<String> {
        Binding(
            get: { figures?.currencyCode ?? "" },
            set: { scopeCurrency = $0 }
        )
    }

    private func loadInsights(timeframe: Int, insightsType: Int) async {
        let loaded = await dataController.transactions.getLogViewInsights(type: timeframe, insightsType: insightsType)

        guard !Task.isCancelled else { return }

        insights = loaded

        if let scopeCurrency, loaded.figures(for: scopeCurrency) == nil {
            self.scopeCurrency = nil
        }
    }
}
