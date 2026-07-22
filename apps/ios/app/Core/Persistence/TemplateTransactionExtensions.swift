import CoreData
import Foundation

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
