import CoreData
import Foundation

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
        startDate ?? Date.now
    }

    var endDate: Date {
        let base = startDate ?? Date.now
        if type == 1 {
            return Calendar.current.date(byAdding: .day, value: 1, to: base) ?? base
        } else if type == 2 {
            return Calendar.current.date(byAdding: .day, value: 7, to: base) ?? base
        } else if type == 3 {
            return Calendar.current.date(byAdding: .month, value: 1, to: base) ?? base
        } else if type == 4 {
            return Calendar.current.date(byAdding: .year, value: 1, to: base) ?? base
        }
        return base
    }
}
