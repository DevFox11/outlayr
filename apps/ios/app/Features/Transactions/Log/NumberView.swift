//
//  NumberView.swift
//  xpenz
//
//  Created by Rafael Soh on 19/5/22.
//

import Foundation
import SwiftUI

/// The Log hero figure. Animatable so the number rolls when the measure, the
/// period or the currency scope changes.
struct NumberView: AnimatableModifier {
    var number: Double
    var dynamicTypeSize: DynamicTypeSize
    let positive: Bool
    /// The currency the figure is denominated in. Nil falls back to the global
    /// preference, which is what a single-currency period resolves to anyway.
    let currencyCode: String?

    @AppStorage(DefaultsKey.showCents, store: AppIdentifiers.sharedDefaults) var showCents: Bool = true

    @AppStorage(DefaultsKey.currency, store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier

    private var formatter: CurrencyAmountFormatter {
        CurrencyAmountFormatter(currencyCode: currencyCode ?? currency, showCents: showCents)
    }

    /// Scaled by hand rather than by `.largeTitle`: the figure is the loudest
    /// thing on the screen and has to stay proportionate to a body-sized
    /// ledger underneath it at every accessibility size.
    var fontSize: CGFloat {
        switch dynamicTypeSize {
        case .xSmall: 36
        case .small: 37
        case .medium: 38
        case .large: 40
        case .xLarge: 44
        case .xxLarge: 47
        case .xxxLarge: 50
        case .accessibility1: 56
        case .accessibility2: 64
        case .accessibility3: 74
        case .accessibility4: 86
        case .accessibility5: 98
        @unknown default: 40
        }
    }

    var animatableData: Double {
        get { number }
        set { number = newValue }
    }

    /// Sized down as the symbol lengthens: a one-character `$` can sit close to
    /// the figure, but a four-character `Bs.D` at the same weight reads as part
    /// of the number.
    private var symbolSize: CGFloat {
        fontSize * (formatter.symbol.count > 1 ? 0.44 : 0.6)
    }

    func body(content _: Content) -> some View {
        HStack(alignment: .lastTextBaseline, spacing: 4) {
            Text(verbatim: (positive ? "+" : "-") + formatter.symbol)
                .font(.system(size: symbolSize, weight: .regular, design: .rounded))
                .foregroundStyle(Color.SubtitleText)

            Text(verbatim: formatter.groupedDigits(number))
                .font(.system(size: fontSize, weight: .regular, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(Color.PrimaryText)
        }
        // Symbol and digits are one figure, not two things to swipe between.
        .accessibilityElement(children: .combine)
        .minimumScaleFactor(0.5)
        .lineLimit(1)
    }
}
