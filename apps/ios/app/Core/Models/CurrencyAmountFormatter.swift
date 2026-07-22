//
//  CurrencyAmountFormatter.swift
//  Outlayr
//

import Foundation

/// Renders an amount in the currency it was recorded in. Every bucketed Log
/// figure goes through this: a bucket that isn't the user's global currency
/// must never borrow the global symbol, or the screen quietly relabels foreign
/// money as local money.
struct CurrencyAmountFormatter {
    let currencyCode: String
    let showCents: Bool
    /// Injectable so the separators and symbol placement a test asserts on are
    /// the ones it asked for rather than the ones the device happens to use.
    let locale: Locale

    /// Resolved once: `Currency.minorUnits(for:)` builds a formatter and a locale
    /// of its own, and this was being read twice per formatter built.
    private let fractionDigits: Int

    init(currencyCode: String, showCents: Bool, locale: Locale = .current) {
        self.currencyCode = currencyCode
        self.showCents = showCents
        self.locale = locale
        fractionDigits = showCents ? Currency.minorUnits(for: currencyCode) : 0
    }

    private var currencyFormatter: NumberFormatter {
        let formatter = NumberFormatter()
        formatter.locale = locale
        formatter.numberStyle = .currency
        formatter.currencyCode = currencyCode
        formatter.minimumFractionDigits = fractionDigits
        formatter.maximumFractionDigits = fractionDigits
        return formatter
    }

    /// Unsigned and symbol-bearing, for callers that draw the sign themselves.
    func magnitudeString(_ amount: Double) -> String {
        currencyFormatter.string(from: NSNumber(value: abs(amount))) ?? currencyCode
    }

    /// Always carries a sign: on a ledger `+` and `-` read as a matched pair,
    /// where a bare number next to a negative one reads as an omission.
    func signedString(_ amount: Double) -> String {
        signedString(magnitude: abs(amount), isPositive: amount >= 0)
    }

    /// The sign is passed separately for figures that are stored unsigned —
    /// spend is a positive number that always renders negative.
    func signedString(magnitude: Double, isPositive: Bool) -> String {
        (isPositive ? "+" : "-") + magnitudeString(magnitude)
    }

    /// Digits only, for the hero, which draws the currency symbol at its own
    /// size and color.
    func groupedDigits(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.locale = locale
        formatter.numberStyle = .decimal
        formatter.usesGroupingSeparator = true
        formatter.minimumFractionDigits = fractionDigits
        formatter.maximumFractionDigits = fractionDigits
        return formatter.string(from: NSNumber(value: abs(amount))) ?? "0"
    }

    var symbol: String {
        locale.localizedCurrencySymbol(forCurrencyCode: currencyCode) ?? currencyCode
    }
}
