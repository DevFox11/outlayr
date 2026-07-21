//
//  AmountEntryDisplayStyle.swift
//  Outlayr
//
//  Glass numpad sheet for amount entry with per-transaction currency
//  switching. The amount display rolls via NumberFlow; keys are Liquid Glass
//  on iOS 26+ with a flat-material fallback on iOS 17.
//

import NumberFlow
import SwiftUI

/// Currency formatting that can render an in-progress entry like "12." — the
/// pending decimal separator is spliced into the attributed output right after
/// the integer digits (so suffix symbols like de_DE's "€" stay outside it) and
/// is sourced from the same formatter that renders the digits.
struct AmountEntryDisplayStyle: NumberFlowFormatStyle {
    private typealias PartAttribute = AttributeScopes.FoundationAttributes.NumberFormatAttributes.NumberPartAttribute
    private typealias SymbolAttribute = AttributeScopes.FoundationAttributes.NumberFormatAttributes.SymbolAttribute

    var base: Decimal.FormatStyle.Currency
    var pendingSeparator: Bool

    init(code: String, fractionLength: Int, pendingSeparator: Bool) {
        // Narrow presentation renders the compact symbol ("$" for MXN, not "MX$")
        // — the header chip already shows the ISO code, so the display stays lean.
        base = .currency(code: code).precision(.fractionLength(fractionLength)).presentation(.narrow)
        self.pendingSeparator = pendingSeparator
    }

    func locale(_ locale: Locale) -> AmountEntryDisplayStyle {
        var copy = self
        copy.base = base.locale(locale)
        return copy
    }

    func format(_ value: Decimal) -> String {
        String(attributedString(for: value).characters)
    }

    func attributedString(for value: Decimal) -> AttributedString {
        var attributed = base.attributed.format(value)
        guard pendingSeparator else { return attributed }

        var insertionIndex: AttributedString.Index?
        for run in attributed.runs where run[PartAttribute.self] == .integer && run[SymbolAttribute.self] == nil {
            insertionIndex = run.range.upperBound
        }
        guard let insertionIndex else { return attributed }

        var separator = AttributedString(separatorText)
        separator[SymbolAttribute.self] = .decimalSeparator
        attributed.insert(separator, at: insertionIndex)
        return attributed
    }

    private var separatorText: String {
        let sample = base.precision(.fractionLength(1)).attributed.format(Decimal(string: "1.1")!)
        for run in sample.runs where run[SymbolAttribute.self] == .decimalSeparator {
            return String(sample.characters[run.range])
        }
        return "."
    }
}
