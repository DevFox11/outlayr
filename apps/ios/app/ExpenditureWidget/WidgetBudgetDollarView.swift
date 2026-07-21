//
//  WidgetBudgetDollarView.swift
//  Outlayr
//

import SwiftUI

struct WidgetBudgetDollarView: View {
    @AppStorage("showCents", store: AppIdentifiers.sharedDefaults) var showCents: Bool = true

    var amount: Double
    var red: Bool

    @AppStorage("currency", store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency)!
    }

    var body: some View {
        HStack(alignment: .lastTextBaseline, spacing: 1.3) {
            Group {
                Text(currencySymbol)
                    .font(.system(.subheadline, design: .rounded).weight(.medium))
                    .foregroundColor(red ? Color("BudgetRed") : Color.SubtitleText) +

                Text("\(amount, specifier: showCents && amount < 100  ? "%.2f" : "%.0f")")
                    .font(.system(.title3, design: .rounded).weight(.medium))
                    .foregroundColor(red ? Color("BudgetRed") : Color.PrimaryText)
            }

        }
        .minimumScaleFactor(0.5)
        .lineLimit(1)
    }
}
