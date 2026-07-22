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
