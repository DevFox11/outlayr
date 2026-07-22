import CoreData
import Foundation

extension Transaction {
    var wrappedAmount: Double {
        amount
    }

    var wrappedDate: Date {
        date ?? Date.now
    }

    var wrappedNote: String {
        note ?? ""
    }

    var wrappedCategoryName: String {
        category?.wrappedName ?? ""
    }

    var wrappedColor: String {
        category?.wrappedColor ?? ""
    }

    /// ISO 4217 code stored on the transaction, or nil to mean "whatever the
    /// global currency is at display time". Anything that isn't three ASCII
    /// letters is rejected rather than passed on: `Locale` currency lookups
    /// return nil for junk codes, and two call sites force-unwrap that result.
    var wrappedCurrency: String? {
        guard let currency else { return nil }
        let normalised = currency.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard normalised.count == 3, normalised.allSatisfy({ $0.isASCII && $0.isLetter }) else { return nil }
        return normalised
    }

    /// Color the transaction should render in: an explicit user override wins,
    /// then the color auto-detected from its image, then the category's color.
    var effectiveColor: String {
        if let customColor, !customColor.isEmpty { return customColor }
        if let imageColor, !imageColor.isEmpty { return imageColor }
        return wrappedColor
    }

    /// The transaction's own symbol, or nil when it has none and should inherit
    /// the category's. Storage is `icon` XOR `emoji`; a blank or unresolvable
    /// icon name counts as absent.
    ///
    /// This is deliberately stricter than `Category.displaySymbol`, which
    /// substitutes the catalog fallback for an unresolvable name. A category is
    /// the last stop, so it must render *something*; a transaction always has a
    /// category behind it, so falling through preserves a real identity instead
    /// of showing a generic glyph the user never chose.
    var ownSymbol: CategorySymbol? {
        if let icon, let resolved = CategoryIconCatalog.icon(named: icon) { return .icon(resolved) }
        if let emoji, !emoji.isEmpty { return .emoji(emoji) }
        return nil
    }

    /// The icon projection of `displaySymbol`, for the contexts that structurally
    /// require a glyph. Derived rather than resolved independently: computing the
    /// two separately let an emoji-only transaction report its emoji here and the
    /// *category's* icon there, contradicting itself.
    var wrappedIcon: CategoryIcon {
        switch displaySymbol {
        case let .icon(icon):
            return icon
        case .emoji:
            return CategoryIconCatalog.fallback(income: category?.income ?? false)
        }
    }

    var displaySymbol: CategorySymbol {
        if let ownSymbol { return ownSymbol }
        return category?.displaySymbol ?? .icon(CategoryIconCatalog.fallback(income: category?.income ?? false))
    }

    var nextTransactionDate: Date {
        if let next = RecurringCadence(rawValue: recurringType)?
            .next(from: day ?? Date.now, coefficient: recurringCoefficient, calendar: .current) {
            return next
        }
        return date ?? Date.now
    }
}
