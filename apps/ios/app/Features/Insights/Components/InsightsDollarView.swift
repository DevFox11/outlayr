//
//  InsightsChartComponents.swift
//  Outlayr
//

import Foundation
import Popovers
import SwiftUI

struct InsightsDollarView: View {
    let amount: Double
    var currencySymbol: String
    var showCents: Bool
    var net: Bool?

    var symbol: String {
        if let netPositive = net {
            if netPositive {
                return "+\(currencySymbol)"
            } else {
                return "-\(currencySymbol)"
            }
        } else {
            return currencySymbol
        }
    }

    var body: some View {
        HStack(alignment: .lastTextBaseline, spacing: 1.3) {
            Group {
                Text(symbol)
                    .font(.system(.title3, design: .rounded).weight(.medium))
                    .foregroundStyle(Color.SubtitleText) +

                Text("\(amount, specifier: showCents && amount < 100 ? "%.2f" : "%.0f")")
                    .font(.system(.title, design: .rounded).weight(.medium))
                    .foregroundStyle(Color.PrimaryText)
            }
        }
        .minimumScaleFactor(0.5)
        .lineLimit(1)
    }

    init(amount: Double, currencySymbol: String, showCents: Bool, net: Bool? = nil) {
        self.amount = amount
        self.currencySymbol = currencySymbol
        self.showCents = showCents
        self.net = net
    }
}
