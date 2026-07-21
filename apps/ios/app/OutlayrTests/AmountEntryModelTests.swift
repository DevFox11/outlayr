//
//  AmountEntryModelTests.swift
//  OutlayrTests
//
//  Pins the amount-entry state machine backing the numpad sheet: digit append,
//  per-currency decimal caps, backspace semantics, the 100M integer cap,
//  currency-switch renormalization, and exact Decimal round-trips.
//

import XCTest

@testable import Outlayr

final class CurrencyMinorUnitsTests: XCTestCase {
    func testDerivesTwoMinorUnitsForUSD() {
        XCTAssertEqual(Currency.minorUnits(for: "USD"), 2)
    }

    func testDerivesZeroMinorUnitsForJPY() {
        XCTAssertEqual(Currency.minorUnits(for: "JPY"), 0)
    }

    func testDerivesThreeMinorUnitsForBHD() {
        XCTAssertEqual(Currency.minorUnits(for: "BHD"), 3)
    }

    func testDerivesTwoMinorUnitsForEUR() {
        XCTAssertEqual(Currency.minorUnits(for: "EUR"), 2)
    }

    func testDerivationIsLocaleIndependent() {
        for code in ["JPY", "BHD"] {
            for identifier in ["de_DE", "ja_JP"] {
                let formatter = NumberFormatter()
                formatter.locale = Locale(identifier: identifier)
                formatter.numberStyle = .currency
                formatter.currencyCode = code
                XCTAssertEqual(
                    formatter.maximumFractionDigits,
                    Currency.minorUnits(for: code),
                    "\(code) minor units drifted under \(identifier)"
                )
            }
        }
    }
}

final class AmountEntryDisplayStyleTests: XCTestCase {
    func testPendingSeparatorFollowsIntegerForPrefixSymbol() {
        let style = AmountEntryDisplayStyle(code: "USD", fractionLength: 0, pendingSeparator: true)
            .locale(Locale(identifier: "en_US"))
        XCTAssertEqual(style.format(12), "$12.")
    }

    func testPendingSeparatorStaysInsideSuffixSymbol() {
        let style = AmountEntryDisplayStyle(code: "EUR", fractionLength: 0, pendingSeparator: true)
            .locale(Locale(identifier: "de_DE"))
        let formatted = style.format(12)
        XCTAssertTrue(formatted.hasPrefix("12,"), "separator must sit against the digits: \(formatted)")
        XCTAssertTrue(formatted.hasSuffix("€"), "suffix symbol must stay last: \(formatted)")
    }

    func testNoPendingSeparatorMatchesPlainCurrencyFormatting() {
        let style = AmountEntryDisplayStyle(code: "USD", fractionLength: 2, pendingSeparator: false)
            .locale(Locale(identifier: "en_US"))
        XCTAssertEqual(style.format(Decimal(string: "12.34")!), "$12.34")
    }

    func testNarrowSymbolDropsCurrencyPrefixForMXN() {
        let style = AmountEntryDisplayStyle(code: "MXN", fractionLength: 2, pendingSeparator: false)
            .locale(Locale(identifier: "en_US"))
        let formatted = style.format(Decimal(string: "12.34")!)
        XCTAssertEqual(formatted, "$12.34", "narrow presentation renders the compact symbol, not MX$: \(formatted)")
        XCTAssertFalse(formatted.contains("MX"), "the MX$ prefix must be gone: \(formatted)")
    }
}

final class AmountDisplayMetricsTests: XCTestCase {
    func testBaseSizeIs40AndStepsDownForLongStrings() {
        XCTAssertEqual(AmountDisplayMetrics.fontSize(forCharacterCount: 5), 40, "short amounts use the 40pt base")
        XCTAssertEqual(AmountDisplayMetrics.fontSize(forCharacterCount: 15), 40, "the max-cap amount still uses the base")
        XCTAssertEqual(AmountDisplayMetrics.fontSize(forCharacterCount: 16), 37)
        XCTAssertEqual(AmountDisplayMetrics.fontSize(forCharacterCount: 17), 34)
        XCTAssertEqual(AmountDisplayMetrics.fontSize(forCharacterCount: 24), 31)
    }

    func testFontSizeIsMonotonicNonIncreasing() {
        let sizes = (1...24).map { AmountDisplayMetrics.fontSize(forCharacterCount: $0) }
        XCTAssertEqual(sizes, sizes.sorted(by: >), "font size must never grow as the amount lengthens")
    }

    /// The max-cap amount "$100,000,000.00" (15 chars, narrow) fits at the 40pt
    /// base on a ~345pt display, so it does not need to step down.
    func testMaxCapAmountFitsAtBaseSize() {
        XCTAssertEqual(AmountDisplayMetrics.fontSize(forCharacterCount: 15), 40)
    }
}

final class AmountEntryModelTests: XCTestCase {
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

    func testStartsEmptyAtZero() {
        let model = model()
        XCTAssertEqual(model.amount, 0)
        XCTAssertFalse(model.hasSeparator)
    }

    func testAppendsIntegerDigits() {
        let model = typed([.digit(1), .digit(2), .digit(3)])
        XCTAssertEqual(model.amount, Decimal(string: "123"))
    }

    func testCollapsesLeadingZero() {
        let model = typed([.digit(0), .digit(5)])
        XCTAssertEqual(model.amount, Decimal(string: "5"))
    }

    func testAppendsFractionDigitsUpToUSDMinorUnits() {
        let model = typed([.digit(1), .digit(2), .separator, .digit(3), .digit(4), .digit(5)])
        XCTAssertEqual(model.amount, Decimal(string: "12.34"))
    }

    func testAllowsThreeFractionDigitsForBHD() {
        let model = typed([.digit(1), .separator, .digit(2), .digit(3), .digit(4)], minorUnits: 3)
        XCTAssertEqual(model.amount, Decimal(string: "1.234"))
    }

    func testIgnoresSeparatorForZeroMinorUnitCurrency() {
        let model = typed([.digit(4), .separator, .digit(2)], minorUnits: 0)
        XCTAssertFalse(model.hasSeparator)
        XCTAssertEqual(model.amount, Decimal(string: "42"))
    }

    func testSecondSeparatorIsIgnored() {
        let model = typed([.digit(1), .separator, .separator, .digit(5)])
        XCTAssertEqual(model.amount, Decimal(string: "1.5"))
    }

    func testCapsIntegerAtOneHundredMillion() {
        var model = typed([.digit(1)] + Array(repeating: .digit(0), count: 8))
        XCTAssertEqual(model.amount, Decimal(100_000_000))
        model.press(.digit(0))
        XCTAssertEqual(model.amount, Decimal(100_000_000))
    }

    func testRejectsDigitThatWouldExceedTheCap() {
        var model = typed(Array(repeating: .digit(9), count: 8))
        XCTAssertEqual(model.amount, Decimal(99_999_999))
        model.press(.digit(9))
        XCTAssertEqual(model.amount, Decimal(99_999_999))
    }

    func testCapDoesNotBlockFractionEntry() {
        let model = typed([.digit(1)] + Array(repeating: .digit(0), count: 8) + [.separator, .digit(9), .digit(9)])
        XCTAssertEqual(model.amount, Decimal(string: "100000000.99"))
    }

    func testBackspaceWalksFractionThenSeparatorThenIntegers() {
        var model = typed([.digit(1), .digit(2), .separator, .digit(3), .digit(4)])
        model.press(.backspace)
        XCTAssertEqual(model.amount, Decimal(string: "12.3"))
        model.press(.backspace)
        XCTAssertEqual(model.amount, Decimal(string: "12"))
        XCTAssertTrue(model.hasSeparator)
        model.press(.backspace)
        XCTAssertFalse(model.hasSeparator)
        XCTAssertEqual(model.amount, Decimal(string: "12"))
        model.press(.backspace)
        XCTAssertEqual(model.amount, Decimal(string: "1"))
        model.press(.backspace)
        XCTAssertEqual(model.amount, 0)
        model.press(.backspace)
        XCTAssertEqual(model.amount, 0)
    }

    func testSwitchingToZeroMinorUnitsStripsFraction() {
        var model = typed([.digit(1), .digit(2), .separator, .digit(3), .digit(4)])
        model.switchCurrency(minorUnits: 0)
        XCTAssertEqual(model.amount, Decimal(string: "12"))
        XCTAssertFalse(model.hasSeparator)
    }

    func testSwitchingBackReenablesFractionEntry() {
        var model = typed([.digit(1), .digit(2), .separator, .digit(3), .digit(4)])
        model.switchCurrency(minorUnits: 0)
        model.switchCurrency(minorUnits: 2)
        model.press(.separator)
        model.press(.digit(5))
        XCTAssertEqual(model.amount, Decimal(string: "12.5"))
    }

    func testSwitchingToFewerMinorUnitsTruncatesFraction() {
        var model = typed([.digit(1), .separator, .digit(2), .digit(3), .digit(4)], minorUnits: 3)
        model.switchCurrency(minorUnits: 2)
        XCTAssertEqual(model.amount, Decimal(string: "1.23"))
    }

    func testSwitchingToMoreMinorUnitsKeepsFraction() {
        var model = typed([.digit(1), .separator, .digit(2), .digit(3)])
        model.switchCurrency(minorUnits: 3)
        XCTAssertEqual(model.amount, Decimal(string: "1.23"))
        model.press(.digit(4))
        XCTAssertEqual(model.amount, Decimal(string: "1.234"))
    }

    func testAmountIsExactDecimalNotDouble() {
        let model = typed([.digit(0), .separator, .digit(1)])
        XCTAssertEqual(model.amount, Decimal(string: "0.1"))
        XCTAssertEqual(model.amount * 10, Decimal(1))
    }

    func testInitFromAmountRoundTrips() {
        let model = AmountEntryModel(amount: Decimal(string: "45.67")!, minorUnits: 2)
        XCTAssertEqual(model.amount, Decimal(string: "45.67"))
        XCTAssertTrue(model.hasSeparator)
    }

    func testInitFromAmountStripsTrailingFractionZeros() {
        let model = AmountEntryModel(amount: Decimal(string: "45.60")!, minorUnits: 2)
        XCTAssertEqual(model.amount, Decimal(string: "45.6"))
    }

    func testInitFromAmountTruncatesToMinorUnits() {
        let model = AmountEntryModel(amount: Decimal(string: "45.67")!, minorUnits: 0)
        XCTAssertEqual(model.amount, Decimal(string: "45"))
        XCTAssertFalse(model.hasSeparator)
    }

    func testInitFromZeroStartsEmpty() {
        let model = AmountEntryModel(amount: 0, minorUnits: 2)
        XCTAssertEqual(model.amount, 0)
        XCTAssertFalse(model.hasSeparator)
    }

    func testInitClampsNegativeAmountsToZero() {
        let model = AmountEntryModel(amount: Decimal(string: "-5.25")!, minorUnits: 2)
        XCTAssertEqual(model.amount, 0)
        XCTAssertFalse(model.hasSeparator)
    }

    func testInitClampsAboveCapIntegerToTheCap() {
        let model = AmountEntryModel(amount: Decimal(999_999_999), minorUnits: 2)
        XCTAssertEqual(model.amount, Decimal(100_000_000))
        XCTAssertFalse(model.hasSeparator)
    }

    func testInitKeepsFractionAtExactlyTheCap() {
        let model = AmountEntryModel(amount: Decimal(string: "100000000.99")!, minorUnits: 2)
        XCTAssertEqual(model.amount, Decimal(string: "100000000.99"))
    }

    func testInitTruncatesSubMinorAmountsToZero() {
        let model = AmountEntryModel(amount: Decimal(string: "0.001")!, minorUnits: 2)
        XCTAssertEqual(model.amount, 0)
        XCTAssertFalse(model.hasSeparator)
    }

    func testInitFromWholeAmountHasNoSeparator() {
        let model = AmountEntryModel(amount: Decimal(120), minorUnits: 2)
        XCTAssertEqual(model.amount, Decimal(120))
        XCTAssertFalse(model.hasSeparator)
    }

    func testDisplayFractionLengthPadsToTwoAtRest() {
        XCTAssertEqual(model(minorUnits: 2).displayFractionLength, 2)
        XCTAssertEqual(model(minorUnits: 3).displayFractionLength, 2)
        XCTAssertEqual(model(minorUnits: 0).displayFractionLength, 0)
    }

    func testDisplayFractionLengthTracksTypedFraction() {
        var model = typed([.digit(1), .separator])
        XCTAssertEqual(model.displayFractionLength, 0)
        XCTAssertTrue(model.showsTrailingSeparator)
        model.press(.digit(5))
        XCTAssertEqual(model.displayFractionLength, 1)
        XCTAssertFalse(model.showsTrailingSeparator)
    }
}
