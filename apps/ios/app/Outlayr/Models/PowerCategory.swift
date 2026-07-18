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

/// Default categories. Colours are assigned by colour psychology so each category
/// *feels* like what it is:
/// - Warm reds/oranges → appetite, energy, urgency (food, dining, fitness, gifts)
/// - Yellow → electricity / attention (utilities)
/// - Greens → freshness, health, growth, money (groceries, health, income)
/// - Teals/cyans → clarity, travel, connection (travel, phone, wellness)
/// - Blues → trust, stability, focus (transport, education, insurance)
/// - Indigo/violet/purple → digital, creativity, escapism (subscriptions, entertainment)
/// - Pinks/magentas → self-expression, care, desire (fashion, gifts)
/// - Browns/earth → grounding, comfort, home (rent, coffee)
/// - Slate/grey → neutral obligation (taxes)
struct SuggestedCategory: Hashable {
    let name: String
    let emoji: String
    let colour: String

    static let expenses: [SuggestedCategory] = [
        SuggestedCategory(name: "Food", emoji: "🍔", colour: "#FF4D4D"),
        SuggestedCategory(name: "Groceries", emoji: "🛒", colour: "#34C759"),
        SuggestedCategory(name: "Dining Out", emoji: "🍽️", colour: "#FF8A00"),
        SuggestedCategory(name: "Coffee", emoji: "☕", colour: "#9B6A43"),
        SuggestedCategory(name: "Transport", emoji: "🚆", colour: "#0A84FF"),
        SuggestedCategory(name: "Fuel", emoji: "⛽", colour: "#E8590C"),
        SuggestedCategory(name: "Rent", emoji: "🏠", colour: "#B4530E"),
        SuggestedCategory(name: "Home", emoji: "🏡", colour: "#7E9B57"),
        SuggestedCategory(name: "Utilities", emoji: "💡", colour: "#FFC400"),
        SuggestedCategory(name: "Phone & Internet", emoji: "📱", colour: "#00A7C4"),
        SuggestedCategory(name: "Subscriptions", emoji: "🔄", colour: "#5E5CE6"),
        SuggestedCategory(name: "Healthcare", emoji: "🩺", colour: "#2FBFA4"),
        SuggestedCategory(name: "Fitness", emoji: "🏋️", colour: "#FF5630"),
        SuggestedCategory(name: "Fashion", emoji: "👗", colour: "#FF4FA3"),
        SuggestedCategory(name: "Sneakers", emoji: "👟", colour: "#C13BF0"),
        SuggestedCategory(name: "Entertainment", emoji: "🎬", colour: "#AF52DE"),
        SuggestedCategory(name: "Travel", emoji: "✈️", colour: "#32ADE6"),
        SuggestedCategory(name: "Education", emoji: "🎓", colour: "#3A5BD9"),
        SuggestedCategory(name: "Gifts", emoji: "🎁", colour: "#FF375F"),
        SuggestedCategory(name: "Pets", emoji: "🐾", colour: "#E4A11B"),
        SuggestedCategory(name: "Family", emoji: "👨‍👩‍👧", colour: "#FF7A59"),
        SuggestedCategory(name: "Insurance", emoji: "🛡️", colour: "#2C4A7C"),
        SuggestedCategory(name: "Taxes", emoji: "🧾", colour: "#6E7787")
    ]

    static let incomes: [SuggestedCategory] = [
        SuggestedCategory(name: "Paycheck", emoji: "💰", colour: "#34C759"),
        SuggestedCategory(name: "Freelance", emoji: "🧑‍💻", colour: "#20C4B8"),
        SuggestedCategory(name: "Part-Time", emoji: "💼", colour: "#3AA0FF"),
        SuggestedCategory(name: "Business", emoji: "🏢", colour: "#2E8B57"),
        SuggestedCategory(name: "Investments", emoji: "💹", colour: "#7CB342"),
        SuggestedCategory(name: "Interest", emoji: "🏦", colour: "#4CAF88"),
        SuggestedCategory(name: "Bonus", emoji: "🎯", colour: "#FFB300"),
        SuggestedCategory(name: "Tips", emoji: "🪙", colour: "#E4A11B"),
        SuggestedCategory(name: "Refund", emoji: "↩️", colour: "#5AC8FA"),
        SuggestedCategory(name: "Gifts", emoji: "🧧", colour: "#E5484D")
    ]
}
