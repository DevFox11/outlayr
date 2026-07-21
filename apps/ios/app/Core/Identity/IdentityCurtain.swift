//
//  IdentityCurtain.swift
//  Outlayr
//
//  The ambient glow curtain shared by the identity sheets, and the pure hue
//  derivation behind it. Mirrors the treatment inlined in CategorySheetSurface:
//  three pastel hues morphing across the top 260pt, hues frozen (never animate),
//  only the vertical reveal moves. iOS 18 gets the MeshGradient; 17 the linear
//  fallback under a fade mask.
//

import SwiftUI

/// The 260pt curtain. `hues` must already be pre-mixed pastel
/// (`CategoryTileShading.curtain`); `revealed` drives the only animated motion.
struct IdentityCurtain: View {
    let hues: [Color]
    let revealed: Bool

    /// Pads or trims any hue list to exactly the three the mesh top row needs,
    /// applying the pastel curtain mix. Emoji-style multi-hue lists lead, the
    /// last color closes — matching the category surface's `curtainHues`.
    static func meshHues(from colors: [Color], in scheme: ColorScheme) -> [Color] {
        let shades = colors.map { CategoryTileShading.curtain($0, in: scheme) }
        switch shades.count {
        case 0: return []
        case 1: return [shades[0], shades[0], shades[0]]
        case 2: return [shades[0], shades[0], shades[1]]
        default: return Array(shades.prefix(3))
        }
    }

    var body: some View {
        mesh
            // Hues must NEVER animate: mesh colors interpolate column-by-column,
            // which reads as a left-to-right sweep. Stripping the transaction is
            // the only reliable way — the reveal rides the same transaction.
            .transaction { $0.animation = nil }
            .frame(height: 260)
            .frame(maxWidth: .infinity)
            // Opacity and offset both key off `revealed`, both governed by the
            // reveal animation below — a fade + descent, matching the surface.
            .opacity(revealed ? 1 : 0)
            .offset(y: revealed ? 0 : -260)
            .animation(.easeInOut(duration: 0.45), value: revealed)
    }

    @ViewBuilder
    private var mesh: some View {
        if hues.count == 3 {
            if #available(iOS 18.0, *) {
                MeshGradient(
                    width: 3,
                    height: 3,
                    points: [
                        [0, 0], [0.5, 0], [1, 0],
                        [0, 0.5], [0.5, 0.42], [1, 0.5],
                        [0, 1], [0.5, 1], [1, 1]
                    ],
                    colors: [
                        hues[0], hues[1], hues[2],
                        hues[0].opacity(0.55), hues[1].opacity(0.5), hues[2].opacity(0.55),
                        hues[0].opacity(0), hues[1].opacity(0), hues[2].opacity(0)
                    ]
                )
            } else {
                LinearGradient(colors: hues, startPoint: .leading, endPoint: .trailing)
                    .mask(
                        LinearGradient(
                            stops: [
                                .init(color: .black, location: 0),
                                .init(color: .black, location: 0.45),
                                .init(color: .clear, location: 1)
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
            }
        } else {
            Color.clear
        }
    }
}
