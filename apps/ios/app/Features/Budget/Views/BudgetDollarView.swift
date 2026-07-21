//
//  BudgetDollarView.swift
//  Outlayr
//

import Foundation
import SwiftUI

struct BudgetDollarView: View {
    @AppStorage(DefaultsKey.showCents, store: AppIdentifiers.sharedDefaults) var showCents: Bool = true

    var amount: Double
    var red: Bool
    var scale: Int
    var size: CGFloat

    @AppStorage(DefaultsKey.currency, store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency)!
    }

    var dynamicTypeSizes: (symbol: Font.TextStyle, amount: Font.TextStyle) {
        if scale == 1 {
            return (.callout, .title3)
        } else if scale == 2 {
            return (.body, .title2)
        } else {
            return (.title2, .largeTitle)
        }
    }

    var body: some View {
        HStack(alignment: .lastTextBaseline, spacing: 1.3) {
            Group {
                Text(currencySymbol)
                    .font(.system(dynamicTypeSizes.symbol, design: .rounded).weight(.medium))
                    .foregroundStyle(red ? Color("BudgetRed") : Color.SubtitleText) +

                Text("\(amount, specifier: showCents && amount < 100 ? "%.2f" : "%.0f")")
                    .font(.system(dynamicTypeSizes.amount, design: .rounded).weight(.medium))
                    .foregroundStyle(red ? Color("BudgetRed") : Color.PrimaryText)
            }
        }
        .minimumScaleFactor(0.5)
        .lineLimit(1)
    }
}
