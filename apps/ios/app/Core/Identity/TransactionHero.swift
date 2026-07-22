//
//  TransactionHero.swift
//  Outlayr
//
//  The transaction identity hero: a photo renders as a 90pt avatar circle with
//  a hairline ring; an emoji or icon keeps the 90pt rounded-20 tile with the
//  0.22 tint wash from categories. The empty state borrows the app's ghost-tile
//  dialect but circular and transaction-specific — a dashed ring, sparkles, a
//  faint spinning spectrum ring hinting at the auto-color detection, and a "+"
//  badge inviting a logo.
//

import SwiftUI
import UIKit

struct TransactionHero: View {
    let selection: TransactionIdentitySelection
    /// Effective color for the emoji/icon wash and the filled ring.
    let tint: Color
    let income: Bool
    var showsReset: Bool = true
    /// When the identity picker is open the tile floats above it: scaled to
    /// `IdentityHero.scale` and offset by `tileOffsetY`, while the caption fades.
    /// Only the tile transforms (the header keeps its resting layout), matching
    /// `CategorySheetSurface`.
    var tileScale: CGFloat = 1
    var tileOffsetY: CGFloat = 0
    var onTap: () -> Void = {}
    var onReset: () -> Void = {}

    private var tileSide: CGFloat { CategoryIconTile.Size.large.tile }
    private var isFloating: Bool { tileScale > 1.001 }

    var body: some View {
        VStack(spacing: 14) {
            Button(action: onTap) {
                tile
            }
            .buttonStyle(GridPressStyle())
            .overlay(alignment: .topTrailing) {
                if showsReset, !selection.isEmpty {
                    resetBadge
                }
            }
            .accessibilityLabel(String(localized: "accessibility.transactionLogo"))
            .accessibilityHint(String(localized: "accessibility.opensLogoPicker"))
            .scaleEffect(tileScale)
            .offset(y: tileOffsetY)
            .zIndex(1)

            Text(selection.isEmpty ? "Add a logo or icon" : "Tap to change")
                .font(.system(.footnote, design: .rounded, weight: .medium))
                .foregroundStyle(Color.SubtitleText)
                .opacity(isFloating ? 0 : 1)
        }
    }

    @ViewBuilder
    private var tile: some View {
        switch selection.symbol {
        case .none:
            emptyTile
        case let .photo(imageData, _):
            photoTile(imageData)
        case let .emoji(value):
            CategoryIconTile(symbol: .emoji(value), tint: tint, size: .large)
        case let .icon(name):
            let icon = CategoryIconCatalog.icon(named: name) ?? CategoryIconCatalog.fallback(income: income)
            CategoryIconTile(symbol: .icon(icon), tint: tint, size: .large)
        }
    }

    private func photoTile(_ imageData: Data) -> some View {
        Group {
            if let image = UIImage(data: imageData) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                Circle().fill(Color.SubtitleText.opacity(0.12))
            }
        }
        .frame(width: tileSide, height: tileSide)
        .clipShape(Circle())
        .overlay {
            Circle().strokeBorder(Color.PrimaryText.opacity(0.14), lineWidth: 1.5)
        }
    }

    /// The filled-state twin of the empty "+" badge: danger-tinted, clears the
    /// identity back to the invitation.
    private var resetBadge: some View {
        Button(action: onReset) {
            Circle()
                .fill(Color.AlertRed)
                .frame(width: 26, height: 26)
                .overlay {
                    ToolbarIcon("cancel-01", size: 14, color: .white)
                }
        }
        .buttonStyle(.plain)
        .offset(x: 8, y: -8)
        .accessibilityLabel(String(localized: "accessibility.removeLogo"))
    }

    private var emptyTile: some View {
        ZStack {
            Circle()
                .fill(
                    RadialGradient(
                        colors: [Color.SubtitleText.opacity(0.10), Color.SubtitleText.opacity(0.04)],
                        center: UnitPoint(x: 0.35, y: 0.28),
                        startRadius: 2,
                        endRadius: tileSide * 0.7
                    )
                )
                .frame(width: tileSide, height: tileSide)

            SpectrumRing()
                .frame(width: tileSide + 12, height: tileSide + 12)

            Circle()
                .strokeBorder(
                    Color.SubtitleText.opacity(0.32),
                    style: StrokeStyle(lineWidth: 1.8, dash: [5, 5])
                )
                .frame(width: tileSide, height: tileSide)

            Image(systemName: "photo")
                .scaledFont(30, weight: .regular)
                .foregroundStyle(Color.SubtitleText)

            Image(systemName: "sparkle")
                .scaledFont(12)
                .foregroundStyle(Color.SubtitleText)
                .offset(x: -tileSide / 2 - 8, y: -tileSide / 2 + 12)

            Image(systemName: "sparkle")
                .scaledFont(9)
                .foregroundStyle(Color.SubtitleText)
                .offset(x: tileSide / 2 + 6, y: 8)

            Circle()
                .fill(Color.PrimaryText)
                .frame(width: 26, height: 26)
                .overlay {
                    ToolbarIcon("plus-sign", style: .solidRounded, size: 14, color: Color.PrimaryBackground)
                }
                .offset(x: tileSide / 2 - 6, y: tileSide / 2 - 6)
        }
    }
}

/// A faint conic spectrum ring that rotates slowly — the empty-state hint that
/// dropping in a photo will detect its color. Decorative only.
private struct SpectrumRing: View {
    @State private var spinning = false

    var body: some View {
        Circle()
            .strokeBorder(AngularGradient(colors: SpectrumHint.colors, center: .center), lineWidth: 2)
            .opacity(0.45)
            .rotationEffect(.degrees(spinning ? 360 : 0))
            .animation(.linear(duration: 14).repeatForever(autoreverses: false), value: spinning)
            .onAppear { spinning = true }
            .accessibilityHidden(true)
    }
}

#Preview("Transaction Hero") {
    struct Demo: View {
        @State private var empty = TransactionIdentitySelection()
        private var emoji: TransactionIdentitySelection {
            var s = TransactionIdentitySelection(); s.selectEmoji("🍿"); return s
        }
        private var icon: TransactionIdentitySelection {
            var s = TransactionIdentitySelection(); s.selectIcon("shopping-cart-01"); return s
        }
        var body: some View {
            HStack(spacing: 28) {
                TransactionHero(selection: empty, tint: Color(hex: "#279AF4"), income: false)
                TransactionHero(selection: emoji, tint: Color(hex: "#F3BF56"), income: false)
                TransactionHero(selection: icon, tint: Color(hex: "#279AF4"), income: false)
            }
            .padding(40)
        }
    }
    return Demo()
}
