//
//  CategoryChip.swift
//  Outlayr
//
//  Created by Rafael Soh on 20/11/23.
//

import SwiftUI

struct CategoryChip: View {
    let symbol: CategorySymbol
    let name: String
    let colourHex: String
    let isChild: Bool
    let isSelected: Bool
    let isDimmed: Bool
    let action: () -> Void

    @Environment(\.colorScheme) private var colorScheme

    private var colour: Color { Color(hex: colourHex) }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 7) {
                if isChild {
                    Image(systemName: "arrow.turn.down.right")
                        .font(.system(.caption2, design: .rounded, weight: .semibold))
                        .opacity(0.7)
                }
                CategoryIconGlyph(symbol: symbol)
                Text(name)
                    .font(.system(isChild ? .subheadline : .body, design: .rounded, weight: .semibold))
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 11)
            .padding(.vertical, isChild ? 7 : 9)
            .foregroundStyle(
                CategoryTileShading.glyph(for: colour, in: colorScheme, washOpacity: isChild ? 0.2 : 0.35)
            )
            .background(colour.opacity(isChild ? 0.2 : 0.35), in: RoundedRectangle(cornerRadius: 11.5, style: .continuous))
            .overlay {
                if isSelected {
                    RoundedRectangle(cornerRadius: 11.5, style: .continuous)
                        .strokeBorder(colour, style: StrokeStyle(lineWidth: 2))
                }
            }
            .opacity(isDimmed ? 0.5 : 1)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}
