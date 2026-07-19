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
    private let icon: CategoryIcon
    private let size: CGFloat

    init(icon: CategoryIcon, size: CGFloat = 15) {
        self.icon = icon
        self.size = size
    }

    var body: some View {
        Text(icon.glyph)
            .font(HugeiconsSolidRounded.font(size: size))
            .accessibilityHidden(true)
    }
}

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
            case .large: 84
            }
        }

        var icon: CGFloat {
            switch self {
            case .small: 15
            case .medium: 18
            case .large: 40
            }
        }

        var radius: CGFloat {
            switch self {
            case .small: 8
            case .medium: 10
            case .large: 18
            }
        }
    }

    private let icon: CategoryIcon
    private let tint: Color
    private let size: Size

    init(icon: CategoryIcon, colour: String, size: Size = .medium) {
        self.init(icon: icon, tint: Color(hex: colour), size: size)
    }

    init(icon: CategoryIcon, tint: Color, size: Size = .medium) {
        self.icon = icon
        self.tint = tint
        self.size = size
    }

    var body: some View {
        RoundedRectangle(cornerRadius: size.radius, style: .continuous)
            .fill(tint.opacity(0.18))
            .frame(width: size.tile, height: size.tile)
            .overlay {
                HugeIcon(
                    codepoint: icon.codepoint,
                    font: HugeiconsSolidRounded.font(size: size.icon),
                    color: tint
                )
            }
    }
}
