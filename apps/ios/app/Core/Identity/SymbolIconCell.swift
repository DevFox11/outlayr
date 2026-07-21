//
//  SymbolIconCell.swift
//  Outlayr
//
//  The emoji browser, grid cells, and emoji-keyboard bridge shared by the
//  category and transaction identity pickers. Extracted from CategoryAlerts.swift
//  (private → internal) so both sheets render the same palette chrome.
//

import HugeiconsCore
import HugeiconsSolidRounded
import SwiftUI
import UIKit

struct SymbolIconCell: View {
    let icon: CategoryIcon
    let tint: Color
    let isSelected: Bool
    let action: () -> Void

    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        Button(action: action) {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(isSelected ? tint.opacity(0.18) : Color.SecondaryBackground)
                .aspectRatio(1, contentMode: .fit)
                .overlay {
                    HugeIcon(
                        codepoint: icon.codepoint,
                        font: HugeiconsSolidRounded.font(size: 20),
                        color: isSelected
                            ? CategoryTileShading.glyph(for: tint, in: colorScheme, washOpacity: 0.18)
                            : Color.SubtitleText
                    )
                }
                .overlay {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .strokeBorder(tint, lineWidth: isSelected ? 2 : 0)
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(verbatim: icon.name))
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}
