//
//  CategoryIconPickerSheet.swift
//  Outlayr
//
//  The reusable identity-sheet surface: the ambient glow curtain, the fixed
//  floating hero, and the nested icon/emoji picker. Extracted from
//  CategoryAlerts.swift so the transaction identity sheet can reuse the same
//  hero geometry, curtain motion, and picker chrome.
//

import SwiftUI

struct CategoryIconPickerSheet: View {
    @Binding var symbol: CategorySymbolSelection
    @Binding var selectedColour: String
    let tint: Color
    let showsColourRow: Bool
    let usedColours: Set<String>

    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var tab: SymbolTab = .icons
    @State private var keyboardEmoji = ""
    @FocusState private var searchFocused: Bool
    @FocusState private var emojiKeyboardFocused: Bool

    private enum SymbolTab: Hashable {
        case icons
        case emoji
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Spacer()
                Button("Done") { dismiss() }
                    .font(.body.weight(.semibold))
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
            .padding(.bottom, 8)

            Picker("Symbol Type", selection: $tab) {
                Text("Icons").tag(SymbolTab.icons)
                Text("Emoji").tag(SymbolTab.emoji)
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 20)
            .padding(.bottom, 12)

            // The emoji palette has no keywords to search against, so the field
            // only exists on the icons tab rather than shipping as dead UI.
            if tab == .icons {
                searchField
            }

            if showsColourRow {
                ColourPickerView(selectedColour: $selectedColour, usedColours: usedColours)
                    .padding(.bottom, 8)
            }

            ScrollView {
                switch tab {
                case .icons:
                    CategoryIconBrowser(
                        selection: Binding(
                            get: { symbol.icon },
                            set: { symbol.selectIcon($0) }
                        ),
                        tint: tint,
                        query: query,
                        headerBackground: Color(.systemGroupedBackground)
                    )
                case .emoji:
                    IdentityEmojiBrowser(
                        selection: symbol.emoji,
                        tint: tint,
                        headerBackground: Color(.systemGroupedBackground),
                        onSelect: { symbol.selectEmoji($0) },
                        onRequestKeyboard: { emojiKeyboardFocused = true }
                    )
                }
            }
        }
        .background(emojiKeyboardField)
        .background(Color(.systemGroupedBackground))
        .presentationDetents([.height(IdentityHero.pickerHeight), .large])
        .presentationDragIndicator(.visible)
        .presentationBackgroundInteraction(.enabled(upThrough: .height(IdentityHero.pickerHeight)))
        .onDisappear {
            searchFocused = false
            emojiKeyboardFocused = false
            query = ""
        }
    }

    /// Zero-sized host for the emoji keyboard. The catalogue covers the common
    /// cases; this is the escape hatch to the rest of Unicode.
    private var emojiKeyboardField: some View {
        EmojiTextField(text: $keyboardEmoji, autoFocus: false) {
            emojiKeyboardFocused = false
        }
            .frame(width: 1, height: 1)
            .opacity(0.01)
            .focused($emojiKeyboardFocused)
            .accessibilityHidden(true)
            .onChange(of: keyboardEmoji) { _, value in
                guard !value.isEmpty else { return }
                symbol.selectEmoji(value)
                keyboardEmoji = ""
                emojiKeyboardFocused = false
            }
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)

            TextField("Search icons", text: $query)
                .focused($searchFocused)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .submitLabel(.search)

            if !query.isEmpty {
                Button {
                    query = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Color(.systemGray6))
        )
        .padding(.horizontal, 20)
        .padding(.bottom, 12)
    }
}
