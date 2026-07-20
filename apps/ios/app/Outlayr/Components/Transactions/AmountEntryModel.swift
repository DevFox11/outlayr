//
//  AmountEntryModel.swift
//  Outlayr
//
//  Pure entry state machine for the numpad amount sheet. Digits accumulate as
//  strings so amounts stay exact Decimals; the fraction is capped by the
//  selected currency's minor units.
//

import Foundation

struct AmountEntryModel: Equatable {
    enum Key: Equatable {
        case digit(Int)
        case separator
        case backspace
    }

    static let integerCap = Decimal(100_000_000)

    private(set) var integerDigits = ""
    private(set) var fractionDigits = ""
    private(set) var hasSeparator = false
    private(set) var minorUnits: Int

    init(minorUnits: Int) {
        self.minorUnits = minorUnits
    }

    init(amount: Decimal, minorUnits: Int) {
        self.init(minorUnits: minorUnits)
        // The pad cannot represent signs: non-positive seeds clamp to an empty (zero) entry.
        guard amount > 0 else { return }

        // NSDecimalNumber's stringValue is locale-independent ("." separator).
        let parts = (amount as NSDecimalNumber).stringValue.split(separator: ".")
        let integer = parts.first.map(String.init) ?? ""

        // Typing enforces the integer cap, so seeding must too — an above-cap seed
        // would otherwise create a state the pad forbids and can only backspace out of.
        let posix = Locale(identifier: "en_US_POSIX")
        if let value = Decimal(string: integer, locale: posix), value > Self.integerCap {
            integerDigits = (Self.integerCap as NSDecimalNumber).stringValue
            return
        }

        integerDigits = integer
        if parts.count > 1 {
            // Sub-minor precision truncates: it is not representable on the pad either.
            var fraction = String(parts[1].prefix(minorUnits))
            while fraction.hasSuffix("0") {
                fraction.removeLast()
            }
            fractionDigits = fraction
            hasSeparator = !fraction.isEmpty
        }
    }

    var amount: Decimal {
        let integer = integerDigits.isEmpty ? "0" : integerDigits
        let text = fractionDigits.isEmpty ? integer : "\(integer).\(fractionDigits)"
        return Decimal(string: text, locale: Locale(identifier: "en_US_POSIX")) ?? 0
    }

    /// At rest the display pads to at most two decimals ("$0.00") even for
    /// three-minor-unit currencies; typing a third reveals it.
    static let restDisplayFractionCap = 2

    var displayFractionLength: Int {
        hasSeparator ? fractionDigits.count : min(Self.restDisplayFractionCap, minorUnits)
    }

    var showsTrailingSeparator: Bool {
        hasSeparator && fractionDigits.isEmpty
    }

    mutating func press(_ key: Key) {
        switch key {
        case .digit(let digit):
            appendDigit(digit)
        case .separator:
            if minorUnits > 0 {
                hasSeparator = true
            }
        case .backspace:
            deleteBackward()
        }
    }

    mutating func switchCurrency(minorUnits newMinorUnits: Int) {
        minorUnits = newMinorUnits
        if newMinorUnits == 0 {
            hasSeparator = false
            fractionDigits = ""
        } else if fractionDigits.count > newMinorUnits {
            fractionDigits = String(fractionDigits.prefix(newMinorUnits))
        }
    }

    private mutating func appendDigit(_ digit: Int) {
        guard (0...9).contains(digit) else { return }

        if hasSeparator {
            guard fractionDigits.count < minorUnits else { return }
            fractionDigits.append(String(digit))
        } else {
            let appended = (integerDigits == "0" ? "" : integerDigits) + String(digit)
            guard let value = Decimal(string: appended, locale: Locale(identifier: "en_US_POSIX")),
                  value <= Self.integerCap else { return }
            integerDigits = appended
        }
    }

    private mutating func deleteBackward() {
        if !fractionDigits.isEmpty {
            fractionDigits.removeLast()
        } else if hasSeparator {
            hasSeparator = false
        } else if !integerDigits.isEmpty {
            integerDigits.removeLast()
        }
    }
}
