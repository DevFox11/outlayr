//
//  InsightsWidgetDollarView.swift
//  Outlayr
//

import SwiftUI

struct InsightsWidgetDollarView: View {
    let currencySymbol: String
    let dollarText: String

    var body: some View {
        HStack(alignment: .lastTextBaseline, spacing: 1.3) {
            Group {
                Text(currencySymbol)
                    .font(.system(.subheadline, design: .rounded).weight(.medium))
                    .foregroundColor(Color.SubtitleText) +

                Text(dollarText)
                    .font(.system(.title3, design: .rounded).weight(.medium))
                    .foregroundColor(Color.PrimaryText)
            }

        }
        .minimumScaleFactor(0.5)
        .lineLimit(1)
    }
}
