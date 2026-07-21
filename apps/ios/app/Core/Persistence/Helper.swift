//
//  Helper.swift
//  Outlayr
//
//  Created by Rafael Soh on 13/8/22.
//

import CoreData
import Foundation

extension Category {
    /// The categories the transaction form's picker offers: top-level only,
    /// scoped to the expense/income mode, ordered by `order`. Shared by the sheet
    /// and its tests so the ordering/hierarchy contract has one definition.
    static func transactionPickerFetchRequest(income: Bool) -> NSFetchRequest<Category> {
        let request = NSFetchRequest<Category>(entityName: "Category")
        request.sortDescriptors = [NSSortDescriptor(keyPath: \Category.order, ascending: true)]
        request.predicate = NSPredicate(format: "income = %d AND parent == nil", income)
        return request
    }
}

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

extension TemplateTransaction {
    var wrappedAmount: Double {
        amount
    }

    var wrappedNote: String {
        note ?? ""
    }

    var wrappedIcon: CategoryIcon {
        category?.wrappedIcon ?? CategoryIconCatalog.fallback(income: category?.income ?? false)
    }

    var displaySymbol: CategorySymbol {
        category?.displaySymbol ?? .icon(CategoryIconCatalog.fallback(income: category?.income ?? false))
    }

    var wrappedColor: String {
        category?.wrappedColor ?? ""
    }
}

extension Category {
    var wrappedColor: String {
        color ?? "#FFFFFF"
    }

    var wrappedIcon: CategoryIcon {
        CategoryIconCatalog.icon(named: icon ?? "") ?? CategoryIconCatalog.fallback(income: income)
    }

    var wrappedEmoji: String? {
        guard let emoji, !emoji.isEmpty else { return nil }
        return emoji
    }

    /// Storage is `icon` XOR `emoji`, so precedence only matters for legacy rows
    /// that predate the rule: a stored icon wins, then emoji, then the fallback.
    var displaySymbol: CategorySymbol {
        if icon != nil { return .icon(wrappedIcon) }
        if let wrappedEmoji { return .emoji(wrappedEmoji) }
        return .icon(CategoryIconCatalog.fallback(income: income))
    }

    var wrappedName: String {
        name ?? ""
    }

    var wrappedDate: Date {
        dateCreated ?? Date.now
    }

    var allTransactions: [Transaction] {
        let set = transactions as? Set<Transaction> ?? []
        return set.sorted {
            $0.wrappedDate < $1.wrappedDate
        }
    }

    var transactionCount: Int {
        transactions?.count ?? 0
    }

    var sortedChildren: [Category] {
        let set = children as? Set<Category> ?? []
        return set.sorted { $0.order < $1.order }
    }

    var hasChildren: Bool {
        (children?.count ?? 0) > 0
    }

    var isSubcategory: Bool {
        parent != nil
    }

    /// Own transactions plus every subcategory's transactions, for rolled-up parent totals.
    var allTransactionsIncludingChildren: [Transaction] {
        var result = allTransactions
        for child in sortedChildren {
            result.append(contentsOf: child.allTransactions)
        }
        return result.sorted { $0.wrappedDate < $1.wrappedDate }
    }
}

public extension Budget {
    var wrappedColor: String {
        category?.wrappedColor ?? "#FFFFFF"
    }

    var wrappedName: String {
        if let name, !name.isEmpty { return name }
        return category?.wrappedName ?? ""
    }

    // internal is required: a public extension would try to export the internal CategoryIcon
    internal var wrappedIcon: CategoryIcon {
        category?.wrappedIcon ?? CategoryIconCatalog.fallback(income: category?.income ?? false)
    }

    internal var displaySymbol: CategorySymbol {
        category?.displaySymbol ?? .icon(CategoryIconCatalog.fallback(income: category?.income ?? false))
    }

    var wrappedDate: Date {
        return startDate ?? Date.now
    }

    var endDate: Date {
        if type == 1 {
            return Calendar.current.date(byAdding: .day, value: 1, to: startDate ?? Date.now)!
        } else if type == 2 {
            return Calendar.current.date(byAdding: .day, value: 7, to: startDate ?? Date.now)!
        } else if type == 3 {
            return Calendar.current.date(byAdding: .month, value: 1, to: startDate ?? Date.now)!
        } else if type == 4 {
            return Calendar.current.date(byAdding: .year, value: 1, to: startDate ?? Date.now)!
        }
        return startDate ?? Date.now
    }
}

public extension MainBudget {
    var wrappedName: String {
        if let name, !name.isEmpty { return name }
        return String(localized: "Overall Budget")
    }

    var wrappedDate: Date {
        return startDate ?? Date.now
    }

    var endDate: Date {
        if type == 1 {
            return Calendar.current.date(byAdding: .day, value: 1, to: startDate ?? Date.now)!
        } else if type == 2 {
            return Calendar.current.date(byAdding: .day, value: 7, to: startDate ?? Date.now)!
        } else if type == 3 {
            return Calendar.current.date(byAdding: .month, value: 1, to: startDate ?? Date.now)!
        } else if type == 4 {
            return Calendar.current.date(byAdding: .year, value: 1, to: startDate ?? Date.now)!
        }

        return startDate ?? Date.now
    }
}
