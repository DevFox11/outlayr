import Foundation

/// Decomposes a Foundation-formatted number into keyed, diffable parts.
///
/// Uses the `NumberFormatStyleAttributes` runs that `value.formatted(style.attributed)`
/// produces — the Foundation analogue of `Intl.NumberFormat.formatToParts` — so grouping,
/// decimal separators, currency placement, and signs are locale-correct by construction.
public enum NumberFlowFormatter {
    private typealias PartAttribute = AttributeScopes.FoundationAttributes.NumberFormatAttributes.NumberPartAttribute
    private typealias SymbolAttribute = AttributeScopes.FoundationAttributes.NumberFormatAttributes.SymbolAttribute

    private enum RawKind: Equatable {
        case digit(value: Int, isFraction: Bool)
        case symbol(text: String, type: String)
    }

    public static func decompose(_ attributed: AttributedString) -> [KeyedPart] {
        let tokens = tokenize(attributed)
        let sections = assignSections(tokens)
        return assignKeys(tokens, sections: sections)
    }

    /// True when the formatted string contains digits outside ASCII `0`–`9`
    /// (Arabic-Indic, Devanagari, ...). The digit wheels render Latin glyphs, so
    /// callers should fall back to a whole-string crossfade for these strings.
    public static func usesNonLatinDigits(_ string: String) -> Bool {
        string.contains { character in
            guard let value = character.wholeNumberValue, (0...9).contains(value) else { return false }
            return !character.isASCII
        }
    }

    private static func tokenize(_ attributed: AttributedString) -> [RawKind] {
        var tokens: [RawKind] = []
        for run in attributed.runs {
            let text = String(attributed.characters[run.range])
            guard !text.isEmpty else { continue }

            if let symbol = run[SymbolAttribute.self] {
                tokens.append(.symbol(text: text, type: symbolType(symbol)))
            } else if let part = run[PartAttribute.self] {
                let isFraction = part == .fraction
                for character in text {
                    if let value = character.wholeNumberValue, (0...9).contains(value) {
                        tokens.append(.digit(value: value, isFraction: isFraction))
                    } else {
                        tokens.append(.symbol(text: String(character), type: "literal"))
                    }
                }
            } else {
                tokens.append(.symbol(text: text, type: "literal"))
            }
        }
        return tokens
    }

    private static func symbolType(_ symbol: SymbolAttribute.Symbol) -> String {
        switch symbol {
        case .groupingSeparator: return "group"
        case .decimalSeparator: return "decimal"
        case .currency: return "currency"
        case .sign: return "sign"
        case .percent: return "percent"
        default: return "symbol"
        }
    }

    private static func assignSections(_ tokens: [RawKind]) -> [KeyedPart.Section] {
        var seenDigit = false
        return tokens.map { token in
            switch token {
            case .digit(_, let isFraction):
                seenDigit = true
                return isFraction ? .fraction : .integer
            case .symbol(_, let type):
                switch type {
                case "group": return .integer
                case "decimal": return .fraction
                default: return seenDigit ? .post : .pre
                }
            }
        }
    }

    private static func assignKeys(_ tokens: [RawKind], sections: [KeyedPart.Section]) -> [KeyedPart] {
        var keyed = [KeyedPart?](repeating: nil, count: tokens.count)

        // Integer-section keys count from the right so the ones digit is always
        // `integer:0` — the invariant that keeps digit identity when the count grows.
        var integerPlace = 0
        var integerSymbolCounts: [String: Int] = [:]
        for index in tokens.indices.reversed() where sections[index] == .integer {
            switch tokens[index] {
            case .digit(let value, _):
                keyed[index] = KeyedPart(
                    key: "integer:\(integerPlace)",
                    kind: .digit(value: value, place: integerPlace),
                    section: .integer
                )
                integerPlace += 1
            case .symbol(let text, let type):
                let count = integerSymbolCounts[type, default: 0]
                keyed[index] = KeyedPart(key: "\(type):\(count)", kind: .symbol(text), section: .integer)
                integerSymbolCounts[type] = count + 1
            }
        }

        var fractionIndex = 0
        var symbolCounts: [String: Int] = [:]
        for index in tokens.indices where sections[index] != .integer {
            switch tokens[index] {
            case .digit(let value, _):
                keyed[index] = KeyedPart(
                    key: "fraction:\(fractionIndex)",
                    kind: .digit(value: value, place: -1 - fractionIndex),
                    section: .fraction
                )
                fractionIndex += 1
            case .symbol(let text, let type):
                let count = symbolCounts[type, default: 0]
                keyed[index] = KeyedPart(key: "\(type):\(count)", kind: .symbol(text), section: sections[index])
                symbolCounts[type] = count + 1
            }
        }

        return keyed.compactMap { $0 }
    }
}
