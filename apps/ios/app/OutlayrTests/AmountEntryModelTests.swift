//
//  AmountEntryModelTests.swift
//  OutlayrTests
//
//  Pins the amount-entry state machine backing the numpad sheet: digit append,
//  per-currency decimal caps, backspace semantics, the 100M integer cap,
//  currency-switch renormalization, and exact Decimal round-trips.
//

import Testing

@testable import Outlayr

struct CurrencyMinorUnitsTests {
    @Test func derivesTwoMinorUnitsForUSD() {
        #expect(Currency.minorUnits(for: "USD") == 2)
    }

    @Test func derivesZeroMinorUnitsForJPY() {
        #expect(Currency.minorUnits(for: "JPY") == 0)
    }

    @Test func derivesThreeMinorUnitsForBHD() {
        #expect(Currency.minorUnits(for: "BHD") == 3)
    }

    @Test func derivesTwoMinorUnitsForEUR() {
        #expect(Currency.minorUnits(for: "EUR") == 2)
    }

    @Test func derivationIsLocaleIndependent() {
        for code in ["JPY", "BHD"] {
            for identifier in ["de_DE", "ja_JP"] {
                let formatter = NumberFormatter()
                formatter.locale = Locale(identifier: identifier)
                formatter.numberStyle = .currency
                formatter.currencyCode = code
                #expect(
                    formatter.maximumFractionDigits == Currency.minorUnits(for: code),
                    "\(code) minor units drifted under \(identifier)"
                )
            }
        }
    }
}

struct AmountEntryDisplayStyleTests {
    @Test func pendingSeparatorFollowsIntegerForPrefixSymbol() {
        let style = AmountEntryDisplayStyle(code: "USD", fractionLength: 0, pendingSeparator: true)
            .locale(Locale(identifier: "en_US"))
        #expect(style.format(12) == "$12.")
    }

    @Test func pendingSeparatorStaysInsideSuffixSymbol() {
        let style = AmountEntryDisplayStyle(code: "EUR", fractionLength: 0, pendingSeparator: true)
            .locale(Locale(identifier: "de_DE"))
        let formatted = style.format(12)
        #expect(formatted.hasPrefix("12,"), "separator must sit against the digits: \(formatted)")
        #expect(formatted.hasSuffix("€"), "suffix symbol must stay last: \(formatted)")
    }

    @Test func noPendingSeparatorMatchesPlainCurrencyFormatting() {
        let style = AmountEntryDisplayStyle(code: "USD", fractionLength: 2, pendingSeparator: false)
            .locale(Locale(identifier: "en_US"))
        #expect(style.format(Decimal(string: "12.34")!) == "$12.34")
    }

    @Test func narrowSymbolDropsCurrencyPrefixForMXN() {
        let style = AmountEntryDisplayStyle(code: "MXN", fractionLength: 2, pendingSeparator: false)
            .locale(Locale(identifier: "en_US"))
        let formatted = style.format(Decimal(string: "12.34")!)
        #expect(formatted == "$12.34", "narrow presentation renders the compact symbol, not MX$: \(formatted)")
        #expect(formatted.contains("MX") == false, "the MX$ prefix must be gone: \(formatted)")
    }
}

struct AmountDisplayMetricsTests {
    @Test func baseSizeIs40AndStepsDownForLongStrings() {
        #expect(AmountDisplayMetrics.fontSize(forCharacterCount: 5) == 40, "short amounts use the 40pt base")
        #expect(AmountDisplayMetrics.fontSize(forCharacterCount: 15) == 40, "the max-cap amount still uses the base")
        #expect(AmountDisplayMetrics.fontSize(forCharacterCount: 16) == 37)
        #expect(AmountDisplayMetrics.fontSize(forCharacterCount: 17) == 34)
        #expect(AmountDisplayMetrics.fontSize(forCharacterCount: 24) == 31)
    }

    @Test func fontSizeIsMonotonicNonIncreasing() {
        let sizes = (1...24).map { AmountDisplayMetrics.fontSize(forCharacterCount: $0) }
        #expect(sizes == sizes.sorted(by: >), "font size must never grow as the amount lengthens")
    }

    /// The max-cap amount "$100,000,000.00" (15 chars, narrow) fits at the 40pt
    /// base on a ~345pt display, so it does not need to step down.
    @Test func maxCapAmountFitsAtBaseSize() {
        #expect(AmountDisplayMetrics.fontSize(forCharacterCount: 15) == 40)
    }
}

struct AmountEntryModelTests {
    private func model(minorUnits: Int = 2) -> AmountEntryModel {
        AmountEntryModel(minorUnits: minorUnits)
    }

    private func typed(_ keys: [AmountEntryModel.Key], minorUnits: Int = 2) -> AmountEntryModel {
        var model = model(minorUnits: minorUnits)
        for key in keys {
            model.press(key)
        }
        return model
    }

    @Test func startsEmptyAtZero() {
        let model = model()
        #expect(model.amount == 0)
        #expect(model.hasSeparator == false)
    }

    @Test func appendsIntegerDigits() {
        let model = typed([.digit(1), .digit(2), .digit(3)])
        #expect(model.amount == Decimal(string: "123"))
    }

    @Test func collapsesLeadingZero() {
        let model = typed([.digit(0), .digit(5)])
        #expect(model.amount == Decimal(string: "5"))
    }

    @Test func appendsFractionDigitsUpToUSDMinorUnits() {
        let model = typed([.digit(1), .digit(2), .separator, .digit(3), .digit(4), .digit(5)])
        #expect(model.amount == Decimal(string: "12.34"))
    }

    @Test func allowsThreeFractionDigitsForBHD() {
        let model = typed([.digit(1), .separator, .digit(2), .digit(3), .digit(4)], minorUnits: 3)
        #expect(model.amount == Decimal(string: "1.234"))
    }

    @Test func ignoresSeparatorForZeroMinorUnitCurrency() {
        let model = typed([.digit(4), .separator, .digit(2)], minorUnits: 0)
        #expect(model.hasSeparator == false)
        #expect(model.amount == Decimal(string: "42"))
    }

    @Test func secondSeparatorIsIgnored() {
        let model = typed([.digit(1), .separator, .separator, .digit(5)])
        #expect(model.amount == Decimal(string: "1.5"))
    }

    @Test func capsIntegerAtOneHundredMillion() {
        var model = typed([.digit(1)] + Array(repeating: .digit(0), count: 8))
        #expect(model.amount == Decimal(100_000_000))
        model.press(.digit(0))
        #expect(model.amount == Decimal(100_000_000))
    }

    @Test func rejectsDigitThatWouldExceedTheCap() {
        var model = typed(Array(repeating: .digit(9), count: 8))
        #expect(model.amount == Decimal(99_999_999))
        model.press(.digit(9))
        #expect(model.amount == Decimal(99_999_999))
    }

    @Test func capDoesNotBlockFractionEntry() {
        let model = typed([.digit(1)] + Array(repeating: .digit(0), count: 8) + [.separator, .digit(9), .digit(9)])
        #expect(model.amount == Decimal(string: "100000000.99"))
    }

    @Test func backspaceWalksFractionThenSeparatorThenIntegers() {
        var model = typed([.digit(1), .digit(2), .separator, .digit(3), .digit(4)])
        model.press(.backspace)
        #expect(model.amount == Decimal(string: "12.3"))
        model.press(.backspace)
        #expect(model.amount == Decimal(string: "12"))
        #expect(model.hasSeparator)
        model.press(.backspace)
        #expect(model.hasSeparator == false)
        #expect(model.amount == Decimal(string: "12"))
        model.press(.backspace)
        #expect(model.amount == Decimal(string: "1"))
        model.press(.backspace)
        #expect(model.amount == 0)
        model.press(.backspace)
        #expect(model.amount == 0)
    }

    @Test func switchingToZeroMinorUnitsStripsFraction() {
        var model = typed([.digit(1), .digit(2), .separator, .digit(3), .digit(4)])
        model.switchCurrency(minorUnits: 0)
        #expect(model.amount == Decimal(string: "12"))
        #expect(model.hasSeparator == false)
    }

    @Test func switchingBackReenablesFractionEntry() {
        var model = typed([.digit(1), .digit(2), .separator, .digit(3), .digit(4)])
        model.switchCurrency(minorUnits: 0)
        model.switchCurrency(minorUnits: 2)
        model.press(.separator)
        model.press(.digit(5))
        #expect(model.amount == Decimal(string: "12.5"))
    }

    @Test func switchingToFewerMinorUnitsTruncatesFraction() {
        var model = typed([.digit(1), .separator, .digit(2), .digit(3), .digit(4)], minorUnits: 3)
        model.switchCurrency(minorUnits: 2)
        #expect(model.amount == Decimal(string: "1.23"))
    }

    @Test func switchingToMoreMinorUnitsKeepsFraction() {
        var model = typed([.digit(1), .separator, .digit(2), .digit(3)])
        model.switchCurrency(minorUnits: 3)
        #expect(model.amount == Decimal(string: "1.23"))
        model.press(.digit(4))
        #expect(model.amount == Decimal(string: "1.234"))
    }

    @Test func amountIsExactDecimalNotDouble() {
        let model = typed([.digit(0), .separator, .digit(1)])
        #expect(model.amount == Decimal(string: "0.1"))
        #expect(model.amount * 10 == Decimal(1))
    }

    @Test func initFromAmountRoundTrips() {
        let model = AmountEntryModel(amount: Decimal(string: "45.67")!, minorUnits: 2)
        #expect(model.amount == Decimal(string: "45.67"))
        #expect(model.hasSeparator)
    }

    @Test func initFromAmountStripsTrailingFractionZeros() {
        let model = AmountEntryModel(amount: Decimal(string: "45.60")!, minorUnits: 2)
        #expect(model.amount == Decimal(string: "45.6"))
    }

    @Test func initFromAmountTruncatesToMinorUnits() {
        let model = AmountEntryModel(amount: Decimal(string: "45.67")!, minorUnits: 0)
        #expect(model.amount == Decimal(string: "45"))
        #expect(model.hasSeparator == false)
    }

    @Test func initFromZeroStartsEmpty() {
        let model = AmountEntryModel(amount: 0, minorUnits: 2)
        #expect(model.amount == 0)
        #expect(model.hasSeparator == false)
    }

    @Test func initClampsNegativeAmountsToZero() {
        let model = AmountEntryModel(amount: Decimal(string: "-5.25")!, minorUnits: 2)
        #expect(model.amount == 0)
        #expect(model.hasSeparator == false)
    }

    @Test func initClampsAboveCapIntegerToTheCap() {
        let model = AmountEntryModel(amount: Decimal(999_999_999), minorUnits: 2)
        #expect(model.amount == Decimal(100_000_000))
        #expect(model.hasSeparator == false)
    }

    @Test func initKeepsFractionAtExactlyTheCap() {
        let model = AmountEntryModel(amount: Decimal(string: "100000000.99")!, minorUnits: 2)
        #expect(model.amount == Decimal(string: "100000000.99"))
    }

    @Test func initTruncatesSubMinorAmountsToZero() {
        let model = AmountEntryModel(amount: Decimal(string: "0.001")!, minorUnits: 2)
        #expect(model.amount == 0)
        #expect(model.hasSeparator == false)
    }

    @Test func initFromWholeAmountHasNoSeparator() {
        let model = AmountEntryModel(amount: Decimal(120), minorUnits: 2)
        #expect(model.amount == Decimal(120))
        #expect(model.hasSeparator == false)
    }

    @Test func displayFractionLengthPadsToTwoAtRest() {
        #expect(model(minorUnits: 2).displayFractionLength == 2)
        #expect(model(minorUnits: 3).displayFractionLength == 2)
        #expect(model(minorUnits: 0).displayFractionLength == 0)
    }

    @Test func displayFractionLengthTracksTypedFraction() {
        var model = typed([.digit(1), .separator])
        #expect(model.displayFractionLength == 0)
        #expect(model.showsTrailingSeparator)
        model.press(.digit(5))
        #expect(model.displayFractionLength == 1)
        #expect(model.showsTrailingSeparator == false)
    }
}
