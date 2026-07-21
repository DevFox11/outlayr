//
//  CategoryIconTile.swift
//  Outlayr
//

import SwiftUI
import UIKit

/// Derives a legible glyph shade from any tint — palette or custom-picked.
/// Rather than fixed recipes per colour, it composites the tint's wash over the
/// sheet, then shades the glyph toward ink (or paper, on dark) exactly as far
/// as needed to clear WCAG's 3:1 graphics contrast against that wash.
enum CategoryTileShading {
    static let washOpacity = 0.22
    static let targetContrast = 3.5

    static func glyph(for tint: Color, in scheme: ColorScheme, washOpacity: Double = CategoryTileShading.washOpacity) -> Color {
        let tintRGB = components(of: tint)
        let sheet: SIMD3<Double> = scheme == .dark
            ? SIMD3(0.11, 0.11, 0.12)
            : SIMD3(0.96, 0.96, 0.96)
        let wash = mix(tintRGB, sheet, 1 - washOpacity)

        let ink = SIMD3<Double>(0.09, 0.09, 0.10)
        let paper = SIMD3<Double>(0.99, 0.99, 0.99)
        let anchor = contrast(ink, wash) >= contrast(paper, wash) ? ink : paper

        if contrast(tintRGB, wash) >= targetContrast { return color(from: tintRGB) }

        // Smallest shade toward the anchor that clears the target, by bisection.
        var lo = 0.0, hi = 1.0
        for _ in 0..<10 {
            let mid = (lo + hi) / 2
            if contrast(mix(tintRGB, anchor, mid), wash) >= targetContrast {
                hi = mid
            } else {
                lo = mid
            }
        }
        let shaded = mix(tintRGB, anchor, hi)
        return contrast(shaded, wash) >= targetContrast ? color(from: shaded) : color(from: anchor)
    }

    /// The contrast the derived glyph actually achieves against the wash —
    /// exists so tests can pin the guarantee for any input colour.
    static func achievedContrast(for tint: Color, in scheme: ColorScheme) -> Double {
        let tintRGB = components(of: tint)
        let sheet: SIMD3<Double> = scheme == .dark
            ? SIMD3(0.11, 0.11, 0.12)
            : SIMD3(0.96, 0.96, 0.96)
        let wash = mix(tintRGB, sheet, 1 - washOpacity)
        let glyphRGB = components(of: glyph(for: tint, in: scheme))
        return contrast(glyphRGB, wash)
    }

    private static func components(of color: Color) -> SIMD3<Double> {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        UIColor(color).getRed(&r, green: &g, blue: &b, alpha: &a)
        return SIMD3(Double(r), Double(g), Double(b))
    }

    private static func mix(_ a: SIMD3<Double>, _ b: SIMD3<Double>, _ t: Double) -> SIMD3<Double> {
        a * (1 - t) + b * t
    }

    private static func relativeLuminance(_ c: SIMD3<Double>) -> Double {
        func channel(_ v: Double) -> Double {
            v <= 0.03928 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * channel(c.x) + 0.7152 * channel(c.y) + 0.0722 * channel(c.z)
    }

    private static func contrast(_ a: SIMD3<Double>, _ b: SIMD3<Double>) -> Double {
        let l1 = relativeLuminance(a), l2 = relativeLuminance(b)
        return (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05)
    }

    private static func color(from c: SIMD3<Double>) -> Color {
        Color(.sRGB, red: c.x, green: c.y, blue: c.z, opacity: 1)
    }

    /// The Health-app curtain shade: the accent pre-mixed toward white (light)
    /// or black (dark) so the gradient stays luminous instead of muddying
    /// against the grouped background. Measured from Health: ~50% toward white.
    static func curtain(_ color: Color, in scheme: ColorScheme) -> Color {
        let c = components(of: color)
        let target: SIMD3<Double> = scheme == .dark ? .zero : SIMD3(1, 1, 1)
        let amount = scheme == .dark ? 0.45 : 0.5
        return self.color(from: mix(c, target, amount))
    }
}
