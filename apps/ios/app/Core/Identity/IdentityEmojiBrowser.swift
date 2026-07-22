//
//  IdentityEmojiBrowser.swift
//  Outlayr
//
//  The emoji browser, grid cells, and emoji-keyboard bridge shared by the
//  category and transaction identity pickers. Extracted from CategoryAlerts.swift
//  (private → internal) so both sheets render the same palette chrome.
//

import SwiftUI

/// The curated emoji palette, grouped to mirror the icon catalogue, with a
/// trailing cell that hands off to the system emoji keyboard.
struct IdentityEmojiBrowser: View {
    let selection: String
    let tint: Color
    var headerBackground: Color = .clear
    let onSelect: (String) -> Void
    let onRequestKeyboard: () -> Void

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 10), count: 6)

    var body: some View {
        LazyVStack(alignment: .leading, spacing: 20, pinnedViews: .sectionHeaders) {
            ForEach(CategoryEmojiCatalog.groups) { group in
                Section {
                    LazyVGrid(columns: columns, spacing: 10) {
                        ForEach(group.emojis, id: \.self) { emoji in
                            SymbolEmojiCell(
                                emoji: emoji,
                                tint: tint,
                                isSelected: emoji == selection
                            ) {
                                onSelect(emoji)
                            }
                        }

                        if group.id == CategoryEmojiCatalog.groups.last?.id {
                            keyboardCell
                        }
                    }
                } header: {
                    Text(LocalizedStringKey(group.title))
                        .font(.system(.subheadline, design: .rounded, weight: .semibold))
                        .foregroundStyle(Color.SubtitleText)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 8)
                        .background(headerBackground)
                }
            }
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 24)
    }

    private var keyboardCell: some View {
        Button(action: onRequestKeyboard) {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Color.SecondaryBackground)
                .aspectRatio(1, contentMode: .fit)
                .overlay {
                    Image(systemName: "keyboard")
                        .scaledFont(18, weight: .medium)
                        .foregroundStyle(Color.SubtitleText)
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(String(localized: "accessibility.moreEmoji"))
        .accessibilityHint(String(localized: "accessibility.opensEmojiKeyboard"))
    }
}
