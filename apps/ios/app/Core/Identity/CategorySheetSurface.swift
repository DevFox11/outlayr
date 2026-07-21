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
