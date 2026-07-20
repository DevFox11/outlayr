/// One diffable unit of a formatted number: a single digit or a run of symbol characters.
///
/// Keys are stable across value changes so the animation layer can diff by identity:
/// integer digits are keyed right-to-left (`integer:0` is always the ones place), which is
/// what makes `999 -> 1000` animate as three rolling digits plus one entering digit.
public struct KeyedPart: Equatable, Sendable {
    public enum Section: Equatable, Sendable {
        case pre
        case integer
        case fraction
        case post
    }

    public enum Kind: Equatable, Sendable {
        /// A single digit. `place` is the decimal exponent of the position:
        /// ones = 0, tens = 1, tenths = -1, hundredths = -2.
        case digit(value: Int, place: Int)
        case symbol(String)
    }

    public let key: String
    public let kind: Kind
    public let section: Section

    public init(key: String, kind: Kind, section: Section) {
        self.key = key
        self.kind = kind
        self.section = section
    }

    public var digitValue: Int? {
        if case .digit(let value, _) = kind { return value }
        return nil
    }

    public var symbolText: String? {
        if case .symbol(let text) = kind { return text }
        return nil
    }
}
