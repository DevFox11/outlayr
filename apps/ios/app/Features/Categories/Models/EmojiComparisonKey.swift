//
//  CategoryIcon.swift
//  Outlayr
//

import Foundation

extension String {
    /// Collation key for comparing two stored emoji. Text- and emoji-presentation
    /// forms of the same glyph ("☕" vs "☕️") must count as one symbol, while skin
    /// tone and ZWJ variants stay distinct because they read as different glyphs.
    /// Comparison only — stored values keep exactly what the user picked.
    ///
    /// Lives here rather than in StringExtension.swift because the intent targets
    /// compile DataController without that file.
    var emojiComparisonKey: String {
        trimmingCharacters(in: .whitespacesAndNewlines)
            .precomposedStringWithCanonicalMapping
            .unicodeScalars
            .filter { $0.value != 0xFE0F }
            .reduce(into: "") { $0.unicodeScalars.append($1) }
    }
}
