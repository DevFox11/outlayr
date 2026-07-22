//
//  GetInsightsIntent.swift
//  Outlayr
//
//  Created by Rafael Soh on 5/8/23.
//

import AppIntents
import Foundation
import SwiftUI

struct ShortcutInsightsView: View {
    let amount: Double
    let type: ShortcutsInsightsType
    let timeframe: ShortcutsInsightsTimeFrame

    @AppStorage(DefaultsKey.showCents, store: AppIdentifiers.sharedDefaults) var showCents: Bool = true

    @AppStorage(DefaultsKey.currency, store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier

    var leftText: String {
        switch type {
        case .net:
            return "Net total"
        case .income:
            return "Earned"
        case .spent:
            return "Spent"
        }
    }

    var rightText: String {
        switch timeframe {
        case .day:
            return "today"
        case .week:
            return "this week"
        case .month:
            return "this month"
        case .year:
            return "this year"
        case .all:
            return "all time"
        }
    }

    var amountString: String {
        let numberFormatter = NumberFormatter()
        numberFormatter.numberStyle = .currency
        numberFormatter.currencyCode = currency

        if showCents {
            numberFormatter.maximumFractionDigits = 2
        } else {
            numberFormatter.maximumFractionDigits = 0
        }

        return numberFormatter.string(from: NSNumber(value: amount)) ?? "$0"
    }

    var body: some View {
        VStack(spacing: 2) {
            Text(leftText + " " + rightText)
                .scaledFont(17, weight: .medium, design: .rounded)
                .foregroundStyle(Color.SubtitleText)

            Text(amountString)
                .scaledFont(32, weight: .medium, design: .rounded)
                .lineLimit(1)
        }
        .padding(20)
    }
}
