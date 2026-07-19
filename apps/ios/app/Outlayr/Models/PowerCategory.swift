//
//  PowerCategory.swift
//  Bonsai
//
//  Created by Rafael Soh on 6/6/22.
//

import Foundation
import SwiftUI

struct PowerCategory: Hashable, Identifiable {
    let id: UUID
    let category: Category
    let percent: Double
    let amount: Double
}

/// Default categories, each pairing a Hugeicons glyph with a colour assigned by
/// colour psychology so the category *feels* like what it is:
/// - Warm reds/oranges → appetite, energy, urgency (food, dining, fitness, gifts)
/// - Yellow → electricity / attention (utilities)
/// - Greens → freshness, health, growth, money (groceries, health, income)
/// - Teals/cyans → clarity, travel, connection (travel, phone, wellness)
/// - Blues → trust, stability, focus (transport, education, insurance)
/// - Indigo/violet/purple → digital, creativity, escapism (subscriptions, entertainment)
/// - Pinks/magentas → self-expression, care, desire (shopping, fashion, personal care, gifts)
/// - Browns/earth → grounding, comfort, home (rent, coffee)
/// - Slate/grey → neutral obligation (taxes)
struct SuggestedCategory: Hashable {
    let name: String
    /// Hugeicons ligature name; must resolve through `CategoryIconCatalog`.
    let icon: String
    let colour: String

    static let expenses: [SuggestedCategory] = [
        SuggestedCategory(name: "Groceries", icon: "shopping-cart-01", colour: "#34C759"),
        SuggestedCategory(name: "Dining Out", icon: "restaurant-01", colour: "#FF8A00"),
        SuggestedCategory(name: "Coffee", icon: "coffee-02", colour: "#9B6A43"),
        SuggestedCategory(name: "Transport", icon: "bus-01", colour: "#0A84FF"),
        SuggestedCategory(name: "Fuel", icon: "fuel-01", colour: "#E8590C"),
        SuggestedCategory(name: "Rent", icon: "home-01", colour: "#B4530E"),
        SuggestedCategory(name: "Home", icon: "sofa-01", colour: "#7E9B57"),
        SuggestedCategory(name: "Utilities", icon: "flash", colour: "#FFC400"),
        SuggestedCategory(name: "Phone & Internet", icon: "wifi-01", colour: "#00A7C4"),
        SuggestedCategory(name: "Subscriptions", icon: "repeat", colour: "#5E5CE6"),
        SuggestedCategory(name: "Healthcare", icon: "health", colour: "#2FBFA4"),
        SuggestedCategory(name: "Fitness", icon: "dumbbell-01", colour: "#FF5630"),
        SuggestedCategory(name: "Shopping", icon: "shopping-bag-01", colour: "#FF4FA3"),
        SuggestedCategory(name: "Fashion", icon: "dress-01", colour: "#C13BF0"),
        SuggestedCategory(name: "Entertainment", icon: "film-roll-01", colour: "#AF52DE"),
        SuggestedCategory(name: "Travel", icon: "airplane-01", colour: "#32ADE6"),
        SuggestedCategory(name: "Education", icon: "mortarboard-01", colour: "#3A5BD9"),
        SuggestedCategory(name: "Gifts", icon: "gift", colour: "#FF375F"),
        SuggestedCategory(name: "Pets", icon: "bone-01", colour: "#E4A11B"),
        SuggestedCategory(name: "Family", icon: "kid", colour: "#FF7A59"),
        SuggestedCategory(name: "Personal Care", icon: "hair-dryer", colour: "#D96FA8"),
        SuggestedCategory(name: "Insurance", icon: "shield-01", colour: "#2C4A7C"),
        SuggestedCategory(name: "Taxes", icon: "t-taxes", colour: "#6E7787")
    ]

    static let incomes: [SuggestedCategory] = [
        SuggestedCategory(name: "Paycheck", icon: "money-bag-01", colour: "#34C759"),
        SuggestedCategory(name: "Freelance", icon: "laptop", colour: "#20C4B8"),
        SuggestedCategory(name: "Part-Time", icon: "briefcase-01", colour: "#3AA0FF"),
        SuggestedCategory(name: "Business", icon: "building-01", colour: "#2E8B57"),
        SuggestedCategory(name: "Investments", icon: "chart-up", colour: "#7CB342"),
        SuggestedCategory(name: "Interest", icon: "percent-circle", colour: "#4CAF88"),
        SuggestedCategory(name: "Bonus", icon: "target-01", colour: "#FFB300"),
        SuggestedCategory(name: "Tips", icon: "tips", colour: "#E4A11B"),
        SuggestedCategory(name: "Refund", icon: "cashback", colour: "#5AC8FA"),
        SuggestedCategory(name: "Gifts", icon: "gift-card", colour: "#E5484D")
    ]

    /// Resolves a stored category name back to the suggestion it was created from.
    /// `SuggestedCategoriesView` persists the *localized* name, so a non-English
    /// store never matches the English literals — both forms are accepted.
    static func match(name: String, income: Bool) -> SuggestedCategory? {
        (income ? incomesByName : expensesByName)[name]
    }

    private static let expensesByName = lookup(expenses)
    private static let incomesByName = lookup(incomes)

    private static func lookup(_ suggestions: [SuggestedCategory]) -> [String: SuggestedCategory] {
        var map: [String: SuggestedCategory] = [:]
        for suggestion in suggestions {
            let keys = [suggestion.name, NSLocalizedString(suggestion.name, comment: "category name")]
            for key in keys where map[key] == nil {
                map[key] = suggestion
            }
        }
        return map
    }
}
