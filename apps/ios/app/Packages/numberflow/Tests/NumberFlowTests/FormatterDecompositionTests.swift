import Foundation
import NumberFlow
import XCTest

final class FormatterDecompositionTests: XCTestCase {
    private func decompose(_ value: Decimal, _ format: some NumberFlowFormatStyle) -> [KeyedPart] {
        NumberFlowFormatter.decompose(format.attributedString(for: value))
    }

    private func digitValue(_ parts: [KeyedPart], _ key: String) -> Int? {
        guard let part = parts.first(where: { $0.key == key }),
              case .digit(let value, _) = part.kind else { return nil }
        return value
    }

    private func digitKeys(_ parts: [KeyedPart]) -> Set<String> {
        Set(parts.compactMap { part in
            if case .digit = part.kind { return part.key }
            return nil
        })
    }

    private func symbolParts(_ parts: [KeyedPart], prefix: String) -> [KeyedPart] {
        parts.filter { $0.key.hasPrefix(prefix) }
    }

    func testIntegerKeysAssignedRightToLeft() {
        let parts = decompose(1234, Decimal.FormatStyle.number.locale(Locale(identifier: "en_US")))
        XCTAssertEqual(digitValue(parts, "integer:0"), 4)
        XCTAssertEqual(digitValue(parts, "integer:1"), 3)
        XCTAssertEqual(digitValue(parts, "integer:2"), 2)
        XCTAssertEqual(digitValue(parts, "integer:3"), 1)
    }

    func testFractionKeysLeftToRightWithNegativePlaces() {
        let parts = decompose(Decimal(string: "1.25")!, Decimal.FormatStyle.number.locale(Locale(identifier: "en_US")))
        guard let tenths = parts.first(where: { $0.key == "fraction:0" }),
              case .digit(let tenthsValue, let tenthsPlace) = tenths.kind else {
            return XCTFail("missing fraction:0")
        }
        XCTAssertEqual(tenthsValue, 2)
        XCTAssertEqual(tenthsPlace, -1)
        guard let hundredths = parts.first(where: { $0.key == "fraction:1" }),
              case .digit(let hundredthsValue, let hundredthsPlace) = hundredths.kind else {
            return XCTFail("missing fraction:1")
        }
        XCTAssertEqual(hundredthsValue, 5)
        XCTAssertEqual(hundredthsPlace, -2)
    }

    func testKeyStability999To1000() {
        let format = Decimal.FormatStyle.number.locale(Locale(identifier: "en_US"))
        let before = decompose(999, format)
        let after = decompose(1000, format)

        XCTAssertEqual(digitKeys(before), ["integer:0", "integer:1", "integer:2"])
        XCTAssertTrue(digitKeys(before).isSubset(of: digitKeys(after)),
                      "existing integer keys must survive the digit-count change")
        XCTAssertEqual(digitKeys(after).subtracting(digitKeys(before)), ["integer:3"])
        XCTAssertEqual(digitValue(after, "integer:3"), 1)
        XCTAssertEqual(digitValue(after, "integer:0"), 0)
        XCTAssertEqual(digitValue(before, "integer:0"), 9)
    }

    func testEnUSCurrencySectionBucketing() {
        let format = Decimal.FormatStyle.Currency(code: "USD").locale(Locale(identifier: "en_US"))
        let parts = decompose(Decimal(string: "1234.50")!, format)

        let currency = symbolParts(parts, prefix: "currency:")
        XCTAssertEqual(currency.count, 1)
        XCTAssertEqual(currency.first?.section, .pre)
        if case .symbol(let text) = currency.first?.kind {
            XCTAssertEqual(text, "$")
        } else {
            XCTFail("currency part must be a symbol")
        }

        let group = symbolParts(parts, prefix: "group:")
        XCTAssertEqual(group.count, 1)
        XCTAssertEqual(group.first?.section, .integer)

        let decimal = symbolParts(parts, prefix: "decimal:")
        XCTAssertEqual(decimal.count, 1)
        XCTAssertEqual(decimal.first?.section, .fraction)

        XCTAssertEqual(digitValue(parts, "integer:3"), 1)
        XCTAssertEqual(digitValue(parts, "integer:0"), 4)
        XCTAssertEqual(digitValue(parts, "fraction:0"), 5)
        XCTAssertEqual(digitValue(parts, "fraction:1"), 0)
    }

    func testDeDECurrencyUsesLocaleSeparatorsAndTrailingSymbol() {
        let format = Decimal.FormatStyle.Currency(code: "EUR").locale(Locale(identifier: "de_DE"))
        let parts = decompose(Decimal(string: "1234.50")!, format)

        let group = symbolParts(parts, prefix: "group:")
        XCTAssertEqual(group.count, 1)
        XCTAssertEqual(group.first?.section, .integer)
        if case .symbol(let text) = group.first?.kind {
            XCTAssertEqual(text, ".")
        } else {
            XCTFail("group part must be a symbol")
        }

        let decimal = symbolParts(parts, prefix: "decimal:")
        if case .symbol(let text) = decimal.first?.kind {
            XCTAssertEqual(text, ",")
        } else {
            XCTFail("decimal part must be a symbol")
        }

        let currency = symbolParts(parts, prefix: "currency:")
        XCTAssertEqual(currency.first?.section, .post, "de_DE currency symbol trails the number")

        XCTAssertEqual(digitValue(parts, "integer:0"), 4)
        XCTAssertEqual(digitValue(parts, "integer:3"), 1)
        XCTAssertEqual(digitValue(parts, "fraction:0"), 5)
        XCTAssertEqual(digitValue(parts, "fraction:1"), 0)
    }

    func testDeDEDecimalStyle() {
        let parts = decompose(Decimal(string: "1234.5")!, Decimal.FormatStyle.number.locale(Locale(identifier: "de_DE")))
        if case .symbol(let group) = symbolParts(parts, prefix: "group:").first?.kind {
            XCTAssertEqual(group, ".")
        } else {
            XCTFail("missing grouping symbol")
        }
        if case .symbol(let decimal) = symbolParts(parts, prefix: "decimal:").first?.kind {
            XCTAssertEqual(decimal, ",")
        } else {
            XCTFail("missing decimal symbol")
        }
        XCTAssertEqual(digitValue(parts, "fraction:0"), 5)
    }

    func testJaJPCurrencyHasLeadingSymbolAndNoFraction() {
        let format = Decimal.FormatStyle.Currency(code: "JPY").locale(Locale(identifier: "ja_JP"))
        let parts = decompose(1234, format)

        let currency = symbolParts(parts, prefix: "currency:")
        XCTAssertEqual(currency.count, 1)
        XCTAssertEqual(currency.first?.section, .pre)

        XCTAssertEqual(digitKeys(parts), ["integer:0", "integer:1", "integer:2", "integer:3"])
        XCTAssertTrue(symbolParts(parts, prefix: "decimal:").isEmpty, "JPY has no fraction digits")
        XCTAssertEqual(digitValue(parts, "integer:0"), 4)
        XCTAssertEqual(digitValue(parts, "integer:3"), 1)
    }

    func testJaJPDecimalStyle() {
        let parts = decompose(Decimal(string: "1234.5")!, Decimal.FormatStyle.number.locale(Locale(identifier: "ja_JP")))
        XCTAssertEqual(digitValue(parts, "integer:0"), 4)
        XCTAssertEqual(digitValue(parts, "integer:3"), 1)
        XCTAssertEqual(digitValue(parts, "fraction:0"), 5)
    }

    func testNegativeValueHasSignSymbolInPreSection() {
        let parts = decompose(Decimal(string: "-1234.5")!, Decimal.FormatStyle.number.locale(Locale(identifier: "en_US")))
        let sign = symbolParts(parts, prefix: "sign:")
        XCTAssertEqual(sign.count, 1)
        XCTAssertEqual(sign.first?.section, .pre)
        XCTAssertEqual(digitValue(parts, "integer:0"), 4)
        XCTAssertEqual(digitValue(parts, "fraction:0"), 5)
    }

    func testHiINLakhGroupingKeysSeparatorsRightToLeft() {
        let parts = decompose(1234567, Decimal.FormatStyle.number.locale(Locale(identifier: "hi_IN")))
        let groups = symbolParts(parts, prefix: "group:")
        XCTAssertEqual(Set(groups.map(\.key)), ["group:0", "group:1"])
        XCTAssertEqual(digitKeys(parts).count, 7)
        XCTAssertEqual(digitValue(parts, "integer:6"), 1)
        XCTAssertEqual(digitValue(parts, "integer:0"), 7)
    }

    func testKeysAreUniqueAcrossLocaleAndStyleMatrix() {
        let locales = ["en_US", "de_DE", "ja_JP", "hi_IN", "ar_EG"].map(Locale.init(identifier:))
        let currencyCodes = ["USD", "EUR", "JPY", "INR", "EGP"]
        let values: [Decimal] = [0, -5, Decimal(string: "1234.5")!, Decimal(string: "1234567.89")!]

        for (locale, code) in zip(locales, currencyCodes) {
            let styles: [any NumberFlowFormatStyle] = [
                Decimal.FormatStyle.number.locale(locale),
                Decimal.FormatStyle.Currency(code: code).locale(locale),
                Decimal.FormatStyle.Percent.percent.locale(locale)
            ]
            for style in styles {
                for value in values {
                    let parts = NumberFlowFormatter.decompose(style.attributedString(for: value))
                    let keys = parts.map(\.key)
                    XCTAssertEqual(Set(keys).count, keys.count,
                                   "duplicate keys for \(value) in \(locale.identifier): \(keys)")
                }
            }
        }
    }

    func testNonLatinDigitDetection() {
        let arabic = Decimal.FormatStyle.number.locale(Locale(identifier: "ar_EG")).format(Decimal(string: "1234.5")!)
        XCTAssertTrue(NumberFlowFormatter.usesNonLatinDigits(arabic))

        let latin = Decimal.FormatStyle.number.locale(Locale(identifier: "en_US")).format(Decimal(string: "1234.5")!)
        XCTAssertFalse(NumberFlowFormatter.usesNonLatinDigits(latin))

        let hindi = Decimal.FormatStyle.number.locale(Locale(identifier: "hi_IN")).format(1234567)
        XCTAssertFalse(NumberFlowFormatter.usesNonLatinDigits(hindi), "hi_IN formats with Latin digits by default")
    }

    func testDisplayOrderIsPreserved() {
        let format = Decimal.FormatStyle.Currency(code: "USD").locale(Locale(identifier: "en_US"))
        let parts = decompose(Decimal(string: "1234.50")!, format)
        let keys = parts.map(\.key)
        XCTAssertEqual(keys, ["currency:0", "integer:3", "group:0", "integer:2", "integer:1", "integer:0", "decimal:0", "fraction:0", "fraction:1"])
    }
}
