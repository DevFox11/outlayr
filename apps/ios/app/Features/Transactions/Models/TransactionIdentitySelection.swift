//
//  TransactionIdentitySelection.swift
//  Outlayr
//
//  The in-flight identity choice on the transaction sheet. A value type so the
//  "photo XOR emoji XOR icon XOR none" rule and the custom-color override are
//  enforced — and unit-testable — outside the view layer. There is no way to
//  construct or mutate one that holds two symbol kinds at once.
//

import Foundation

struct TransactionIdentitySelection: Equatable {
    /// The mutually exclusive symbol kinds a transaction can carry. `.photo`
    /// pairs the stored JPEG with the color extracted from it; `.icon` only
    /// ever holds a catalog-resolvable name (the reducer refuses the rest).
    enum Symbol: Equatable {
        case none
        case photo(imageData: Data, imageColor: String)
        case emoji(String)
        case icon(String)
    }

    private(set) var symbol: Symbol
    /// A user-picked color that overrides whatever the identity would derive.
    /// `nil` means "auto": fall back to the photo's extracted color, then the
    /// category's. Restored by `restoreAutoColor()`.
    private(set) var customColor: String?

    init() {
        symbol = .none
        customColor = nil
    }

    /// Seeds from stored transaction attributes, applying the same precedence as
    /// `Transaction.ownSymbol`: a catalog-resolvable icon wins, then a non-empty
    /// emoji, then image data. An unresolvable stored icon is treated as absent.
    init(transaction: Transaction) {
        if let icon = transaction.icon, CategoryIconCatalog.icon(named: icon) != nil {
            symbol = .icon(icon)
        } else if let emoji = transaction.emoji, !emoji.isEmpty {
            symbol = .emoji(emoji)
        } else if let data = transaction.imageData, !data.isEmpty {
            symbol = .photo(imageData: data, imageColor: transaction.imageColor ?? "")
        } else {
            symbol = .none
        }
        if let custom = transaction.customColor, !custom.isEmpty {
            customColor = custom
        } else {
            customColor = nil
        }
    }

    var isEmpty: Bool {
        if case .none = symbol { return true }
        return false
    }

    /// The color the identity resolves to on its own, before the category
    /// behind it: the override wins, then a photo's extracted color, else nil
    /// (icons and emoji inherit — their glow comes from derived hues elsewhere).
    var effectiveColor: String? {
        if let customColor, !customColor.isEmpty { return customColor }
        if case let .photo(_, color) = symbol, !color.isEmpty { return color }
        return nil
    }

    // MARK: - Reducer

    /// Choosing a fresh identity always resets the color to auto — the newly
    /// detected (or inherited) color should show until the user overrides again.
    mutating func selectPhoto(imageData: Data, imageColor: String) {
        symbol = .photo(imageData: imageData, imageColor: imageColor)
        customColor = nil
    }

    mutating func selectEmoji(_ value: String) {
        symbol = .emoji(value)
        customColor = nil
    }

    /// Refuses names the catalog can't resolve: an unstorable icon must never
    /// reach the model, which would render a fallback glyph the user never
    /// chose. Returns whether the selection was accepted — deliberately NOT
    /// `@discardableResult`, so a caller wiring a free-text or stored name
    /// (e.g. the #38 form) must consciously handle rejection instead of
    /// silently leaving the identity on its previous symbol.
    mutating func selectIcon(_ name: String) -> Bool {
        guard CategoryIconCatalog.icon(named: name) != nil else { return false }
        symbol = .icon(name)
        customColor = nil
        return true
    }

    mutating func clear() {
        symbol = .none
        customColor = nil
    }

    mutating func overrideColor(_ hex: String) {
        customColor = hex
    }

    mutating func restoreAutoColor() {
        customColor = nil
    }

    /// Writes the selection back to a managed transaction, mapping empty to nil
    /// so unset fields are absent rather than blank. Enforces the XOR at the
    /// storage layer: exactly one of icon/emoji/imageData is non-nil.
    func apply(to transaction: Transaction) {
        switch symbol {
        case .none:
            transaction.icon = nil
            transaction.emoji = nil
            transaction.imageData = nil
            transaction.imageColor = nil
        case let .icon(name):
            transaction.icon = name
            transaction.emoji = nil
            transaction.imageData = nil
            transaction.imageColor = nil
        case let .emoji(value):
            transaction.emoji = value
            transaction.icon = nil
            transaction.imageData = nil
            transaction.imageColor = nil
        case let .photo(imageData, imageColor):
            transaction.imageData = imageData
            transaction.imageColor = imageColor.isEmpty ? nil : imageColor
            transaction.icon = nil
            transaction.emoji = nil
        }
        transaction.customColor = customColor?.isEmpty == false ? customColor : nil
    }
}
