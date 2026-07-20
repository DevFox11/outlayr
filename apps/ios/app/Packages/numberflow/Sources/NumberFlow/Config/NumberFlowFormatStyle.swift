import Foundation

/// A Decimal format style that can also produce the attributed output NumberFlow needs
/// for locale-correct part decomposition.
public protocol NumberFlowFormatStyle: FormatStyle where FormatInput == Decimal, FormatOutput == String {
    func attributedString(for value: Decimal) -> AttributedString
}

extension Decimal.FormatStyle: NumberFlowFormatStyle {
    public func attributedString(for value: Decimal) -> AttributedString {
        attributed.format(value)
    }
}

extension Decimal.FormatStyle.Currency: NumberFlowFormatStyle {
    public func attributedString(for value: Decimal) -> AttributedString {
        attributed.format(value)
    }
}

extension Decimal.FormatStyle.Percent: NumberFlowFormatStyle {
    public func attributedString(for value: Decimal) -> AttributedString {
        attributed.format(value)
    }
}
