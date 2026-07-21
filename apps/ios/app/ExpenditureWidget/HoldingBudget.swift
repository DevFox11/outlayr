//
//  HoldingBudget.swift
//  Outlayr
//

import Foundation

struct HoldingBudget {
    let type: Int
    let symbol: CategorySymbol
    let name: String
    let color: String
    let budgetAmount: Double
    var missing: Bool = false

    /// Stands in when the configured budget no longer exists.
    static let failed = HoldingBudget(
        type: 1, symbol: .icon(CategoryIconCatalog.fallback(income: false)),
        name: "", color: "", budgetAmount: 0, missing: true
    )
}
