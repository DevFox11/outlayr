//
//  RecentTransactionsDollarView.swift
//  Outlayr
//

import SwiftUI

struct RecentTransactionsDollarView: View {
    var amount: Double
    var showCents: Bool
    var net: Bool
    var bigger: Bool = false

    @AppStorage(DefaultsKey.currency, store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency)!
    }

    var actualAmount: Double {
        if net {
            return abs(amount)
        } else {
            return amount
        }
    }

    var body: some View {
        HStack(alignment: .lastTextBaseline, spacing: 1.3) {
            Group {
                Text(net ? "\(amount < 0 ? "-" : (amount == 0 ? "" : "+"))\(currencySymbol)" : currencySymbol)
                    .font(.system(bigger ? .title3 : .subheadline, design: .rounded).weight(.medium))
                    .foregroundColor(Color.SubtitleText) +

                Text("\(actualAmount, specifier: showCents && actualAmount < 100  ? "%.2f" : "%.0f")")
                    .font(.system(bigger ? .title : .title3, design: .rounded).weight(.medium))
                    .foregroundColor(Color.PrimaryText)
            }

        }
        .minimumScaleFactor(0.5)
        .lineLimit(1)
    }
}
