//
//  AmountDisplayMetrics.swift
//  Outlayr
//
//  Glass numpad sheet for amount entry with per-transaction currency
//  switching. The amount display rolls via NumberFlow; keys are Liquid Glass
//  on iOS 26+ with a flat-material fallback on iOS 17.
//

import NumberFlow
import SwiftUI

/// Steps the amount font down by formatted length so a max-cap amount
/// (100M + fraction + symbol) fits the sheet width. NumberFlow's digit columns
/// are fixed-metric, so `minimumScaleFactor` mis-scales them (glyphs overlap);
/// discrete size steps keyed to character count are the correct fit strategy.
enum AmountDisplayMetrics {
    /// Base step size (40pt ≈ 48pt line height). The max-cap amount
    /// "$100,000,000.00" (15 chars, narrow) already fits at the base on a ~345pt
    /// display; the down-steps are defensive for pathological longer strings
    /// (wide symbols / non-narrow locales). SF Rounded medium.
    static func fontSize(forCharacterCount count: Int) -> CGFloat {
        switch count {
        case ..<16: return 40
        case 16: return 37
        case 17: return 34
        default: return 31
        }
    }
}
