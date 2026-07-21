//
//  CategoryIcon.swift
//  Outlayr
//

import Foundation

/// The in-flight symbol choice on the category sheets. Kept as a value type so
/// the XOR rule is enforced (and testable) outside the view layer: there is no
/// way to construct or mutate one that holds both an icon and an emoji.
struct CategorySymbolSelection: Equatable {
    private(set) var icon: String
    private(set) var emoji: String

    private init(icon: String, emoji: String) {
        self.icon = icon
        self.emoji = emoji
    }

    init() {
        self.init(icon: "", emoji: "")
    }

    /// Seeds from stored values, normalising legacy rows that hold both: the icon
    /// wins, matching `displaySymbol` precedence, and the emoji is dropped.
    init(category: Category) {
        let storedIcon = category.icon ?? ""
        if storedIcon.isEmpty {
            self.init(icon: "", emoji: category.wrappedEmoji ?? "")
        } else {
            self.init(icon: storedIcon, emoji: "")
        }
    }

    var isEmpty: Bool { icon.isEmpty && emoji.isEmpty }

    mutating func selectIcon(_ name: String) {
        icon = name
        emoji = ""
    }

    mutating func selectEmoji(_ value: String) {
        emoji = value
        icon = ""
    }

    /// Writes the selection back, mapping empty to nil so an unset symbol is
    /// absent rather than an empty string.
    func apply(to category: Category) {
        category.icon = icon.isEmpty ? nil : icon
        category.emoji = emoji.isEmpty ? nil : emoji
    }
}
