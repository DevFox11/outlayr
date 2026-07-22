//
//  LogMeasureCellView.swift
//  Outlayr
//

import SwiftUI

/// One of the two measures the hero is not currently showing. It reads as a
/// ledger column, and tapping it promotes it — which is what keeps all three
/// figures on screen and one tap apart instead of buried in a context menu.
struct LogMeasureCellView: View {
    let measure: LogMeasure
    let figures: TransactionRepository.LogViewInsights.Figures
    let showCents: Bool
    let promote: () -> Void

    private var formatter: CurrencyAmountFormatter {
        CurrencyAmountFormatter(currencyCode: figures.currencyCode, showCents: showCents)
    }

    private var amountText: String {
        formatter.signedString(
            magnitude: measure.magnitude(in: figures),
            isPositive: measure.isPositive(in: figures)
        )
    }

    var body: some View {
        Button(action: promote) {
            VStack(alignment: .leading, spacing: 3) {
                MonoLabel(LocalizedStringKey(measure.titleKey))

                Text(amountText)
                    .font(.system(.callout, design: .rounded).weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(measure.isIncome ? Color.IncomeGreen : Color.PrimaryText)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 10)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(LocalizedStringKey(measure.titleKey)) + Text(verbatim: ", \(amountText)"))
        .accessibilityHint("Show this figure")
        .accessibilityAddTraits(.isButton)
    }
}
