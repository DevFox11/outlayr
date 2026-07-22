//
//  WidgetSymbolGlyph.swift
//  Outlayr
//

import HugeiconsCore
import HugeiconsSolidRounded
import SwiftUI

/// Renders a budget's category symbol at widget scale: a Hugeicons glyph in
/// the given color, or the emoji itself (emoji carry their own colors; on
/// lock-screen rendering modes the system desaturates them, as it does for
/// every widget image).
struct WidgetSymbolGlyph: View {
    let symbol: CategorySymbol
    let size: CGFloat
    var color: Color?

    var body: some View {
        switch symbol {
        case let .icon(icon):
            if let color {
                HugeIcon(
                    codepoint: icon.codepoint,
                    font: HugeiconsSolidRounded.font(size: size),
                    color: color
                )
            } else {
                HugeIcon(
                    codepoint: icon.codepoint,
                    font: HugeiconsSolidRounded.font(size: size)
                )
            }
        case let .emoji(emoji):
            Text(emoji)
                .scaledFont(size)
        }
    }
}
