//
//  CategoryIcon.swift
//  Outlayr
//

import Foundation

/// A Hugeicons solid-rounded glyph addressed by its ligature name.
/// Codepoints are extracted from the bundled hgi-solid-rounded.ttf GSUB table by
/// `apps/ios/scripts/extract_hugeicons_codepoints.py`; re-run it after a font bump
/// to re-derive this table. Names not present in that font must never be added here.
struct CategoryIcon: Hashable, Identifiable {
    let name: String
    let codepoint: UInt32

    var id: String { name }

    /// The single character the Hugeicons font maps to this glyph.
    var glyph: String {
        UnicodeScalar(codepoint).map(String.init) ?? ""
    }
}
