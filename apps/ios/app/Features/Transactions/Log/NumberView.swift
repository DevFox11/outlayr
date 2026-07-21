//
//  NumberView.swift
//  xpenz
//
//  Created by Rafael Soh on 19/5/22.
//

import Foundation
import SwiftUI

struct NumberView: AnimatableModifier {
    var number: Double
    var dynamicTypeSize: DynamicTypeSize
    let netTotal: Bool
    let positive: Bool

    @AppStorage("showCents", store: AppIdentifiers.sharedDefaults) var showCents: Bool = true

    @AppStorage("currency", store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency) ?? currency
    }

    var fontSize: CGFloat {
        switch dynamicTypeSize {
        case .xSmall:
            return 46
        case .small:
            return 47
        case .medium:
            return 48
        case .large:
            return 50
        case .xLarge:
            return 56
        case .xxLarge:
            return 58
        case .xxxLarge:
            return 62
        default:
            return 50
        }
    }
    var animatableData: Double {
        get { number }
        set { number = newValue }
    }

    func body(content _: Content) -> some View {
        HStack(alignment: .lastTextBaseline, spacing: 2) {
            Group {
                Text(netTotal ? (positive ? "+\(currencySymbol)" : "-\(currencySymbol)") : currencySymbol)
                    .font(.system(.largeTitle, design: .rounded))
                    .foregroundStyle(Color.SubtitleText) +

                Text("\(number, specifier: showCents  ? "%.2f" : "%.0f")")
                    .font(.system(size: fontSize, weight: .regular, design: .rounded))
                    .foregroundStyle(Color.PrimaryText)
            }
        }
        .minimumScaleFactor(0.5)
        .lineLimit(1)

    }
}
