//
//  DetailedBudgetDollarView.swift
//  Outlayr
//

import CoreData
import Foundation
import SwiftUI

struct DetailedBudgetDollarView: View {
    var amount: Double
    @AppStorage("showCents", store: AppIdentifiers.sharedDefaults) var showCents: Bool = true

    @AppStorage("currency", store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency)!
    }

    var body: some View {
        HStack(alignment: .lastTextBaseline, spacing: 1.3) {
            Group {
                Text(currencySymbol)
                    .font(.system(.title2, design: .rounded).weight(.medium))
                    .foregroundStyle(Color.SubtitleText) +

                Text("\(amount, specifier: showCents && amount < 100 ? "%.2f" : "%.0f")")
                    .font(.system(.largeTitle, design: .rounded).weight(.medium))
                    .foregroundStyle(Color.PrimaryText)
            }
        }
        .minimumScaleFactor(0.5)
        .lineLimit(1)
    }
}
