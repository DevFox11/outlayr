//
//  BudgetInsightsIntent.swift
//  Outlayr
//
//  Created by Rafael Soh on 6/8/23.
//

import AppIntents
import Foundation
import SwiftUI

struct ShortcutBudgetView: View {
    let amount: Double
    let type: Int

    @AppStorage(DefaultsKey.showCents, store: AppIdentifiers.sharedDefaults) var showCents: Bool = true

    @AppStorage(DefaultsKey.currency, store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier

    var budgetType: String {
        switch type {
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

    var amountString: String {
        let numberFormatter = NumberFormatter()
        numberFormatter.numberStyle = .currency
        numberFormatter.currencyCode = currency

        if showCents {
            numberFormatter.maximumFractionDigits = 2
        } else {
            numberFormatter.maximumFractionDigits = 0
        }

        return numberFormatter.string(from: NSNumber(value: abs(amount))) ?? "$0"
    }

    var body: some View {
        VStack(spacing: 2) {
            Text(amountString)
                .scaledFont(32, weight: .medium, design: .rounded)
                .lineLimit(1)

            if amount > 0 {
                Text("left \(budgetType)")
                    .scaledFont(16, weight: .medium, design: .rounded)
                    .foregroundStyle(Color.SubtitleText)
            } else {
                Text("over \(budgetType)")
                    .scaledFont(16, weight: .medium, design: .rounded)
                    .foregroundStyle(Color.SubtitleText)
            }
        }
        .padding(20)
    }
}
