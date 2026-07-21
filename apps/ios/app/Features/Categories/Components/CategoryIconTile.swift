//
//  CategoryIconTile.swift
//  Outlayr
//

import HugeiconsCore
import HugeiconsSolidRounded
import SwiftUI

/// The canonical category glyph: a tinted rounded tile with the category's icon.
struct CategoryIconTile: View {
    enum Size {
        case small
        case medium
        case large

        var tile: CGFloat {
            switch self {
            case .small: 28
            case .medium: 34
            case .large: 90
            }
        }

        var icon: CGFloat {
            switch self {
            case .small: 15
            case .medium: 18
            case .large: 42
            }
        }

        var radius: CGFloat {
            switch self {
            case .small: 8
            case .medium: 10
            case .large: 20
            }
        }
    }

    private let symbol: CategorySymbol
    private let tint: Color
    private let size: Size

    init(icon: CategoryIcon, color: String, size: Size = .medium) {
        self.init(symbol: .icon(icon), tint: Color(hex: color), size: size)
    }

    init(icon: CategoryIcon, tint: Color, size: Size = .medium) {
        self.init(symbol: .icon(icon), tint: tint, size: size)
    }

    init(symbol: CategorySymbol, color: String, size: Size = .medium) {
        self.init(symbol: symbol, tint: Color(hex: color), size: size)
    }

    init(symbol: CategorySymbol, tint: Color, size: Size = .medium) {
        self.symbol = symbol
        self.tint = tint
        self.size = size
    }

    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        RoundedRectangle(cornerRadius: size.radius, style: .continuous)
            .fill(tint.opacity(CategoryTileShading.washOpacity))
            .frame(width: size.tile, height: size.tile)
            .overlay {
                switch symbol {
                case let .icon(icon):
                    HugeIcon(
                        codepoint: icon.codepoint,
                        font: HugeiconsSolidRounded.font(size: size.icon),
                        color: CategoryTileShading.glyph(for: tint, in: colorScheme)
                    )
                case let .emoji(emoji):
                    Text(emoji)
                        .font(.system(size: size.icon))
                }
            }
    }
}
