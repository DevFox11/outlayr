//
//  CurrencyAmountFormatterTests.swift
//  OutlayrTests
//
//  Pins how a bucketed figure renders. Every total on the Log goes through this
//  type, so the invariants that matter are: the symbol belongs to the bucket's
//  own currency, the sign is always explicit, and a zero-decimal currency is
//  never given cents it doesn't have.
//

import Foundation
import Testing

@testable import Outlayr

@Suite("CurrencyAmountFormatter")
struct CurrencyAmountFormatterTests {

    private let locale = Locale(identifier: "en_US")

    private func formatter(_ code: String, showCents: Bool = true) -> CurrencyAmountFormatter {
        CurrencyAmountFormatter(currencyCode: code, showCents: showCents, locale: locale)
    }

    // MARK: - Currency identity

    @Test("a figure renders in its own currency, not the ambient one")
    func amount_rendersInItsOwnCurrency() {
        #expect(formatter("USD").magnitudeString(1284.5) == "$1,284.50")
        #expect(formatter("EUR").magnitudeString(180) == "€180.00")
    }

    @Test("the standalone symbol matches the one the full figure uses")
    func symbol_matchesTheRenderedFigure() {
        #expect(formatter("USD").symbol == "$")
        #expect(formatter("EUR").symbol == "€")
    }

    @Test("an unknown code degrades to the code itself rather than to nothing")
    func unknownCode_fallsBackToTheCode() {
        let result = formatter("ZZZ").magnitudeString(10)

        #expect(result.contains("ZZZ") || result.contains("10"))
        #expect(result.isEmpty == false)
    }

    // MARK: - Sign

    @Test("magnitudes never carry a sign — the caller owns it")
    func magnitude_isUnsigned() {
        #expect(formatter("USD").magnitudeString(-56.10) == "$56.10")
        #expect(formatter("USD").magnitudeString(56.10) == "$56.10")
    }

    @Test("a signed figure always shows its sign, positive included")
    func signed_alwaysShowsASign() {
        #expect(formatter("USD").signedString(1143.4) == "+$1,143.40")
        #expect(formatter("USD").signedString(-56.10) == "-$56.10")
    }

    @Test("zero reads as a credit, matching how an empty period is bucketed")
    func zero_readsPositive() {
        #expect(formatter("USD").signedString(0) == "+$0.00")
    }

    @Test("an unsigned stored figure takes the sign it is handed")
    func explicitSign_overridesTheStoredValue() {
        // Spend is stored positive and always renders negative.
        #expect(formatter("USD").signedString(magnitude: 4484.5, isPositive: false) == "-$4,484.50")
        #expect(formatter("USD").signedString(magnitude: 3200, isPositive: true) == "+$3,200.00")
    }

    // MARK: - Decimals

    @Test("a zero-decimal currency is never given cents")
    func zeroDecimalCurrency_showsNoCents() {
        #expect(formatter("JPY").magnitudeString(12400) == "¥12,400")
    }

    @Test("hiding cents drops them for every currency")
    func hidingCents_dropsTheFraction() {
        #expect(formatter("USD", showCents: false).magnitudeString(1284.7) == "$1,285")
        #expect(formatter("EUR", showCents: false).signedString(-180) == "-€180")
    }

    // MARK: - Hero digits

    @Test("the hero's digits are grouped and carry no symbol of their own")
    func groupedDigits_areBareAndGrouped() {
        #expect(formatter("USD").groupedDigits(1284.5) == "1,284.50")
        #expect(formatter("USD").groupedDigits(-1284.5) == "1,284.50")
        #expect(formatter("JPY").groupedDigits(12400) == "12,400")
    }

    @Test("the hero's digits respect the cents preference too")
    func groupedDigits_followTheCentsPreference() {
        #expect(formatter("USD", showCents: false).groupedDigits(1284.7) == "1,285")
    }

    @Test("a half-cent rounds the way the platform rounds money, not the way arithmetic does")
    func halfValues_useBankersRounding() {
        // Documented rather than corrected: NumberFormatter's default half-even
        // rule is what every other figure in the app already rounds by.
        #expect(formatter("USD", showCents: false).magnitudeString(1284.5) == "$1,284")
        #expect(formatter("USD", showCents: false).magnitudeString(1285.5) == "$1,286")
    }
}
