//
//  CategoryIconTile.swift
//  Outlayr
//

import HugeiconsCore
import HugeiconsSolidRounded
import SwiftUI

/// A bare category glyph for the text-adjacent rows where an emoji used to sit
/// inline. Unlike `HugeIcon` it inherits the ambient foreground style, so it
/// picks up whatever tint the surrounding label already applies.
struct CategoryIconGlyph: View {
    private let symbol: CategorySymbol
    private let size: CGFloat

    init(icon: CategoryIcon, size: CGFloat = 15) {
        self.init(symbol: .icon(icon), size: size)
    }

    init(symbol: CategorySymbol, size: CGFloat = 15) {
        self.symbol = symbol
        self.size = size
    }

    var body: some View {
        Group {
            switch symbol {
            case let .icon(icon):
                Text(icon.glyph)
                    .font(HugeiconsSolidRounded.font(size: size))
            case let .emoji(emoji):
                // Emoji carry their own color, so they only need the metric.
                Text(emoji)
                    .font(.system(size: size))
            }
        }
        .accessibilityHidden(true)
    }
}
