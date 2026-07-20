//
//  Helper.swift
//  Outlayr
//
//  Created by Rafael Soh on 13/8/22.
//

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

    var wrappedColour: String {
        category?.wrappedColour ?? ""
    }

    var wrappedIcon: CategoryIcon {
        category?.wrappedIcon ?? CategoryIconCatalog.fallback(income: category?.income ?? false)
    }

    var displaySymbol: CategorySymbol {
        category?.displaySymbol ?? .icon(CategoryIconCatalog.fallback(income: category?.income ?? false))
    }

    var nextTransactionDate: Date {
        if recurringType == 1 {
            return Calendar.current.date(byAdding: .day, value: Int(recurringCoefficient), to: day ?? Date.now)!
        } else if recurringType == 2 {
            return Calendar.current.date(byAdding: .day, value: Int(recurringCoefficient * 7), to: day ?? Date.now)!
        } else if recurringType == 3 {
            return Calendar.current.date(byAdding: .month, value: Int(recurringCoefficient), to: day ?? Date.now)!
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

    var wrappedColour: String {
        category?.wrappedColour ?? ""
    }
}

extension Category {
    var wrappedColour: String {
        colour ?? "#FFFFFF"
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
    var wrappedColour: String {
        category?.wrappedColour ?? "#FFFFFF"
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
