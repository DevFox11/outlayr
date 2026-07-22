//
//  PowerCategory.swift
//  Bonsai
//
//  Created by Rafael Soh on 6/6/22.
//

import Foundation

/// Default categories, each pairing a Hugeicons glyph with a color assigned by
/// color psychology so the category *feels* like what it is:
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
    let color: String

    static let expenses: [SuggestedCategory] = [
        SuggestedCategory(name: "Groceries", icon: "shopping-cart-01", color: "#34C759"),
        SuggestedCategory(name: "Dining Out", icon: "restaurant-01", color: "#FF8A00"),
        SuggestedCategory(name: "Coffee", icon: "coffee-02", color: "#9B6A43"),
        SuggestedCategory(name: "Transport", icon: "bus-01", color: "#0A84FF"),
        SuggestedCategory(name: "Fuel", icon: "fuel-01", color: "#E8590C"),
        SuggestedCategory(name: "Rent", icon: "home-01", color: "#B4530E"),
        SuggestedCategory(name: "Home", icon: "sofa-01", color: "#7E9B57"),
        SuggestedCategory(name: "Utilities", icon: "flash", color: "#FFC400"),
        SuggestedCategory(name: "Phone & Internet", icon: "wifi-01", color: "#00A7C4"),
        SuggestedCategory(name: "Subscriptions", icon: "repeat", color: "#5E5CE6"),
        SuggestedCategory(name: "Healthcare", icon: "health", color: "#2FBFA4"),
        SuggestedCategory(name: "Fitness", icon: "dumbbell-01", color: "#FF5630"),
        SuggestedCategory(name: "Shopping", icon: "shopping-bag-01", color: "#FF4FA3"),
        SuggestedCategory(name: "Fashion", icon: "dress-01", color: "#C13BF0"),
        SuggestedCategory(name: "Entertainment", icon: "film-roll-01", color: "#AF52DE"),
        SuggestedCategory(name: "Travel", icon: "airplane-01", color: "#32ADE6"),
        SuggestedCategory(name: "Education", icon: "mortarboard-01", color: "#3A5BD9"),
        SuggestedCategory(name: "Gifts", icon: "gift", color: "#FF375F"),
        SuggestedCategory(name: "Pets", icon: "bone-01", color: "#E4A11B"),
        SuggestedCategory(name: "Family", icon: "kid", color: "#FF7A59"),
        SuggestedCategory(name: "Personal Care", icon: "hair-dryer", color: "#D96FA8"),
        SuggestedCategory(name: "Insurance", icon: "shield-01", color: "#2C4A7C"),
        SuggestedCategory(name: "Taxes", icon: "t-taxes", color: "#6E7787")
    ]

    static let incomes: [SuggestedCategory] = [
        SuggestedCategory(name: "Paycheck", icon: "money-bag-01", color: "#34C759"),
        SuggestedCategory(name: "Freelance", icon: "laptop", color: "#20C4B8"),
        SuggestedCategory(name: "Part-Time", icon: "briefcase-01", color: "#3AA0FF"),
        SuggestedCategory(name: "Business", icon: "building-01", color: "#2E8B57"),
        SuggestedCategory(name: "Investments", icon: "chart-up", color: "#7CB342"),
        SuggestedCategory(name: "Interest", icon: "percent-circle", color: "#4CAF88"),
        SuggestedCategory(name: "Bonus", icon: "target-01", color: "#FFB300"),
        SuggestedCategory(name: "Tips", icon: "tips", color: "#E4A11B"),
        SuggestedCategory(name: "Refund", icon: "cashback", color: "#5AC8FA"),
        SuggestedCategory(name: "Gifts", icon: "gift-card", color: "#E5484D")
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
