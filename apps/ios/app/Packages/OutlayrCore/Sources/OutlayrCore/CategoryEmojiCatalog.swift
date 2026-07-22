//
//  CategoryIcon.swift
//  Outlayr
//

import Foundation

/// The curated emoji palette for the picker's Emoji tab. Grouped to mirror
/// `CategoryIconCatalog.groups` so the two tabs read as one system. There are no
/// keywords for emoji, so the picker hides search on this tab; anything outside
/// this list is reachable through the system emoji keyboard.
enum CategoryEmojiCatalog {
    struct Group: Identifiable {
        let title: String
        let emojis: [String]

        var id: String { title }
    }

    static let groups: [Group] = [
        Group(title: "Food & Drink", emojis: [
            "🍎", "🍞", "🥐", "🍔", "🍕", "🌮", "🍣", "🥗",
            "🍜", "🍦", "🍰", "☕️", "🍺", "🍷", "🥤", "🛒"
        ]),
        Group(title: "Shopping", emojis: [
            "🛍️", "👕", "👗", "👟", "👜", "💄", "💍", "🎁",
            "📦", "🧾"
        ]),
        Group(title: "Transport & Travel", emojis: [
            "🚗", "🚕", "🚌", "🚆", "🚲", "🛵", "✈️", "⛽️",
            "🅿️", "🚢", "🧳", "🗺️", "🏖️", "🏝️", "🎒"
        ]),
        Group(title: "Home & Utilities", emojis: [
            "🏠", "🏡", "🔑", "🛋️", "🛏️", "🚿", "🧹", "🧺",
            "💡", "🔌", "🔥", "💧", "📶", "🛠️", "🪴"
        ]),
        Group(title: "Health & Fitness", emojis: [
            "💊", "🩺", "🏥", "🦷", "👓", "🧘", "🏋️", "🏃",
            "⚽️", "🚴", "🧴", "💇"
        ]),
        Group(title: "Leisure", emojis: [
            "🎬", "🎮", "🎧", "🎵", "📚", "🎨", "🎤", "🎭",
            "📺", "🎲", "🎪", "📸"
        ]),
        Group(title: "Money & Work", emojis: [
            "💰", "💵", "💳", "🏦", "📈", "📉", "💼", "🧑‍💻",
            "🏢", "🧮", "🪙", "🤝", "📊", "🎓", "✏️", "🏫"
        ]),
        Group(title: "Life & Other", emojis: [
            "🐶", "🐱", "🐾", "👶", "👨‍👩‍👧", "❤️", "🎉", "🎂",
            "⭐️", "🌍", "☂️", "🔔", "📱", "💻", "✉️", "❓"
        ])
    ]

    static let all: [String] = groups.flatMap(\.emojis)

    /// Pinned so a change to the curated palette is a deliberate edit, not a drift.
    static let curatedCount = 112
}
