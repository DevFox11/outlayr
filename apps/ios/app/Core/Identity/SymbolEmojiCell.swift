//
//  SymbolEmojiCell.swift
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

struct SymbolEmojiCell: View {
    let emoji: String
    let tint: Color
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(isSelected ? tint.opacity(0.18) : Color.SecondaryBackground)
                .aspectRatio(1, contentMode: .fit)
                .overlay {
                    Text(emoji)
                        .font(.system(size: 26))
                }
                .overlay {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .strokeBorder(tint, lineWidth: isSelected ? 2 : 0)
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(verbatim: emoji))
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}
