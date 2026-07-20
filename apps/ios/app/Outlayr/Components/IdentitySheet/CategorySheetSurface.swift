//
//  CategorySheetSurface.swift
//  Outlayr
//
//  The reusable identity-sheet surface: the ambient glow curtain, the fixed
//  floating hero, and the nested icon/emoji picker. Extracted from
//  CategoryAlerts.swift so the transaction identity sheet can reuse the same
//  hero geometry, curtain motion, and picker chrome.
//

import SwiftUI

enum IdentityHero {
    /// Reference sizes: 90pt at rest in the header, 164pt floating over the picker.
    static let expandedSize: CGFloat = 164
    static var scale: CGFloat { expandedSize / CategoryIconTile.Size.large.tile }
    static let pickerHeight: CGFloat = 430
    static let motion = Animation.spring(response: 0.4, dampingFraction: 0.85)
    static let topPadding: CGFloat = 24
    static let bottomPadding: CGFloat = 28
    /// The empty state's caption hangs below the tile, so the header needs
    /// extra room before the first card while it is showing.
    static let captionClearance: CGFloat = 24
    static var restingCenterY: CGFloat { topPadding + CategoryIconTile.Size.large.tile / 2 }
}

// MARK: - Sheet surface

/// Hosts the form on the native grouped surface and owns what sits outside it:
/// the ambient glow, the fixed hero header, and the nested icon picker.
///
/// The hero never lives inside the `Form` (per-cell UIKit hosting breaks both
/// matched geometry and preference propagation) — it sits in a fixed header
/// above it, like the reference app, and travels to its floating placement
/// with a plain deterministic offset+scale spring.
struct CategorySheetSurface<FormContent: View>: View {
    @Binding var symbol: CategorySymbolSelection
    @Binding var selectedColour: String
    @Binding var choosingIcon: Bool
    let income: Bool
    let showsColourRow: Bool
    let usedColours: Set<String>
    let onHeroTap: () -> Void
    @ViewBuilder let form: FormContent

    private var tint: Color {
        income ? Color.IncomeGreen : Color(hex: selectedColour)
    }

    private var hasSymbol: Bool { !symbol.isEmpty }

    private var previewSymbol: CategorySymbol {
        // Icon-first, matching `displaySymbol`; the selection type makes the
        // both-set case unreachable, but the two orders must not disagree.
        if !symbol.icon.isEmpty {
            return .icon(CategoryIconCatalog.icon(named: symbol.icon) ?? CategoryIconCatalog.fallback(income: income))
        }
        if !symbol.emoji.isEmpty { return .emoji(symbol.emoji) }
        return .icon(CategoryIconCatalog.fallback(income: income))
    }

    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        GeometryReader { proxy in
            VStack(spacing: 0) {
                hero(in: proxy)
                    .padding(.top, IdentityHero.topPadding)
                    .padding(.bottom, IdentityHero.bottomPadding + (hasSymbol ? 0 : IdentityHero.captionClearance))
                    .frame(maxWidth: .infinity)
                    .zIndex(1)

                form
                    .scrollContentBackground(.hidden)
                    .contentMargins(.top, 8, for: .scrollContent)
                    .opacity(choosingIcon ? 0 : 1)
                    .blur(radius: choosingIcon ? 8 : 0)
                    .allowsHitTesting(!choosingIcon)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
            .background { backgroundLayer }
            .animation(IdentityHero.motion, value: choosingIcon)
        }
        .sheet(isPresented: $choosingIcon) {
            CategoryIconPickerSheet(
                symbol: $symbol,
                selectedColour: $selectedColour,
                tint: tint,
                showsColourRow: showsColourRow,
                usedColours: usedColours
            )
        }
    }

    private func hero(in proxy: GeometryProxy) -> some View {
        Button(action: onHeroTap) {
            if hasSymbol {
                CategoryIconTile(symbol: previewSymbol, tint: tint, size: .large)
            } else {
                emptyHeroTile
            }
        }
        .buttonStyle(GridPressStyle())
        .disabled(choosingIcon)
        .accessibilityLabel("Category icon")
        .accessibilityHint("Opens the icon picker")
        .overlay(alignment: .topTrailing) {
            if hasSymbol && !choosingIcon {
                resetBadge
            }
        }
        .scaleEffect(choosingIcon ? IdentityHero.scale : 1)
        .offset(y: choosingIcon ? openHeroOffset(in: proxy) : 0)
    }

    /// The filled-state twin of the empty state's "+" badge: same size and
    /// weight, danger-tinted, clearing the symbol back to the invitation.
    private var resetBadge: some View {
        Button {
            withAnimation(IdentityHero.motion) {
                symbol = CategorySymbolSelection()
            }
        } label: {
            Circle()
                .fill(Color.AlertRed)
                .frame(width: 26, height: 26)
                .overlay {
                    ToolbarIcon("cancel-01", size: 14, color: .white)
                }
        }
        .buttonStyle(.plain)
        .offset(x: 8, y: -8)
        .accessibilityLabel("Remove icon")
    }

    /// Speaks the Budgets empty state's ghost dialect: soft fill, gentle dashed
    /// outline, sparkles, a "+" badge that reads as tappable, and an invitation
    /// below. The decoration hides while the tile floats over the picker.
    private var emptyHeroTile: some View {
        let radius = CategoryIconTile.Size.large.radius
        let tile = CategoryIconTile.Size.large.tile
        return RoundedRectangle(cornerRadius: radius, style: .continuous)
            .fill(Color.SubtitleText.opacity(0.05))
            .frame(width: tile, height: tile)
            .overlay {
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .strokeBorder(
                        Color.SubtitleText.opacity(0.32),
                        style: StrokeStyle(lineWidth: 1.8, dash: [5, 5])
                    )
            }
            .overlay {
                if !choosingIcon {
                    heroInvitation
                }
            }
    }

    private var heroInvitation: some View {
        ZStack {
            Image(systemName: "sparkle")
                .font(.system(size: 12))
                .foregroundStyle(Color.SubtitleText.opacity(0.45))
                .offset(x: -62, y: -30)

            Image(systemName: "sparkle")
                .font(.system(size: 9))
                .foregroundStyle(Color.SubtitleText.opacity(0.45))
                .offset(x: 60, y: 8)

            Circle()
                .fill(Color.PrimaryText)
                .frame(width: 26, height: 26)
                .overlay {
                    ToolbarIcon("plus-sign", style: .solidRounded, size: 14, color: Color.PrimaryBackground)
                }
                .offset(
                    x: CategoryIconTile.Size.large.tile / 2 - 6,
                    y: CategoryIconTile.Size.large.tile / 2 - 6
                )

            Text("Choose an icon & colour")
                .font(.system(.footnote, design: .rounded, weight: .medium))
                .foregroundStyle(Color.SubtitleText)
                .fixedSize()
                .offset(y: CategoryIconTile.Size.large.tile / 2 + 22)
        }
    }

    /// How far the hero travels down to sit centred in the space the picker
    /// leaves uncovered, measured from its resting spot in the header.
    private func openHeroOffset(in proxy: GeometryProxy) -> CGFloat {
        let restingCenter = IdentityHero.restingCenterY
        let heroHalf = CategoryIconTile.Size.large.tile * IdentityHero.scale / 2
        let free = proxy.size.height - IdentityHero.pickerHeight
        let target = max(free / 2, 16 + heroHalf)
        return target - restingCenter
    }

    /// Icons glow in the category tint alone; emoji blend their own dominant
    /// hues at the core with the chosen category colour at the rim.
    private var glowColors: [Color] {
        if case let .emoji(emoji) = previewSymbol, hasSymbol {
            let derived = EmojiGlow.colors(for: emoji)
            if !derived.isEmpty { return derived + [tint] }
        }
        return [tint]
    }

    /// The Health-app treatment, measured from the real app: pastel accents
    /// (pre-mixed toward white) morphing horizontally across the top — the way
    /// Health blends pinned sections' colours — dissolving by 260pt, before the
    /// first card. Rendered by the shared `IdentityCurtain` so the category and
    /// (forthcoming) transaction sheets can never drift apart.
    private var backgroundLayer: some View {
        Color(.systemGroupedBackground)
            .overlay(alignment: .top) {
                IdentityCurtain(
                    hues: IdentityCurtain.meshHues(from: glowColors, in: colorScheme),
                    revealed: hasSymbol
                )
            }
            .ignoresSafeArea()
    }
}

// MARK: - Nested icon picker

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
