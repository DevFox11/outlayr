//
//  CategoryIconTile.swift
//  Outlayr
//

import HugeiconsCore
import HugeiconsSolidRounded
import SwiftUI
import UIKit

/// A bare category glyph for the text-adjacent rows where an emoji used to sit
/// inline. Unlike `HugeIcon` it inherits the ambient foreground style, so it
/// picks up whatever tint the surrounding label already applies.
struct CategoryIconGlyph: View {
    private let symbol: CategorySymbol
    private let size: CGFloat

    init(icon: CategoryIcon, size: CGFloat = 15) {
        self.init(symbol: .icon(icon), size: size)
    }

    init(symbol: CategorySymbol, size: CGFloat = 15) {
        self.symbol = symbol
        self.size = size
    }

    var body: some View {
        Group {
            switch symbol {
            case let .icon(icon):
                Text(icon.glyph)
                    .font(HugeiconsSolidRounded.font(size: size))
            case let .emoji(emoji):
                // Emoji carry their own colour, so they only need the metric.
                Text(emoji)
                    .font(.system(size: size))
            }
        }
        .accessibilityHidden(true)
    }
}

/// The canonical category glyph: a tinted rounded tile with the category's icon.
struct CategoryIconTile: View {
    enum Size {
        case small
        case medium
        case large

        var tile: CGFloat {
            switch self {
            case .small: 28
            case .medium: 34
            case .large: 90
            }
        }

        var icon: CGFloat {
            switch self {
            case .small: 15
            case .medium: 18
            case .large: 42
            }
        }

        var radius: CGFloat {
            switch self {
            case .small: 8
            case .medium: 10
            case .large: 20
            }
        }
    }

    private let symbol: CategorySymbol
    private let tint: Color
    private let size: Size

    init(icon: CategoryIcon, colour: String, size: Size = .medium) {
        self.init(symbol: .icon(icon), tint: Color(hex: colour), size: size)
    }

    init(icon: CategoryIcon, tint: Color, size: Size = .medium) {
        self.init(symbol: .icon(icon), tint: tint, size: size)
    }

    init(symbol: CategorySymbol, colour: String, size: Size = .medium) {
        self.init(symbol: symbol, tint: Color(hex: colour), size: size)
    }

    init(symbol: CategorySymbol, tint: Color, size: Size = .medium) {
        self.symbol = symbol
        self.tint = tint
        self.size = size
    }

    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        RoundedRectangle(cornerRadius: size.radius, style: .continuous)
            .fill(tint.opacity(CategoryTileShading.washOpacity))
            .frame(width: size.tile, height: size.tile)
            .overlay {
                switch symbol {
                case let .icon(icon):
                    HugeIcon(
                        codepoint: icon.codepoint,
                        font: HugeiconsSolidRounded.font(size: size.icon),
                        color: CategoryTileShading.glyph(for: tint, in: colorScheme)
                    )
                case let .emoji(emoji):
                    Text(emoji)
                        .font(.system(size: size.icon))
                }
            }
    }
}

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

/// Extracts an emoji's dominant hues so ambient effects can glow in the
/// emoji's own colours instead of the category tint. Icons stay monochrome;
/// emoji bring a palette, and the glow should listen to it.
enum EmojiGlow {
    private static var cache: [String: [Color]] = [:]

    /// Up to two dominant colours, most-present first. Empty when the emoji
    /// renders without any saturated ink (callers fall back to the tint).
    static func colors(for emoji: String) -> [Color] {
        if let hit = cache[emoji] { return hit }
        let derived = extract(from: emoji)
        cache[emoji] = derived
        return derived
    }

    private static func extract(from emoji: String) -> [Color] {
        let side = 24
        var pixels = [UInt8](repeating: 0, count: side * side * 4)
        guard let context = CGContext(
            data: &pixels,
            width: side,
            height: side,
            bitsPerComponent: 8,
            bytesPerRow: side * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return [] }

        UIGraphicsPushContext(context)
        NSAttributedString(
            string: emoji,
            attributes: [.font: UIFont.systemFont(ofSize: CGFloat(side) * 0.85)]
        ).draw(at: .zero)
        UIGraphicsPopContext()

        // Hue histogram over saturated, opaque pixels: 12 buckets, each
        // accumulating a weighted mean colour.
        let buckets = 12
        var weight = [Double](repeating: 0, count: buckets)
        var sum = [SIMD3<Double>](repeating: .zero, count: buckets)

        for i in stride(from: 0, to: pixels.count, by: 4) {
            let a = Double(pixels[i + 3]) / 255
            guard a > 0.5 else { continue }
            let r = Double(pixels[i]) / 255 / a
            let g = Double(pixels[i + 1]) / 255 / a
            let b = Double(pixels[i + 2]) / 255 / a

            let hi = max(r, g, b), lo = min(r, g, b)
            let saturation = hi == 0 ? 0 : (hi - lo) / hi
            guard saturation > 0.15, hi > 0.15 else { continue }

            let delta = hi - lo
            var hue: Double
            if delta == 0 { hue = 0 } else if hi == r { hue = ((g - b) / delta).truncatingRemainder(dividingBy: 6) } else if hi == g { hue = (b - r) / delta + 2 } else { hue = (r - g) / delta + 4 }
            hue = (hue / 6 + 1).truncatingRemainder(dividingBy: 1)

            let bucket = min(Int(hue * Double(buckets)), buckets - 1)
            let w = saturation * a
            weight[bucket] += w
            sum[bucket] += SIMD3(r, g, b) * w
        }

        let ranked = weight.indices
            .filter { weight[$0] > 0 }
            .sorted { weight[$0] > weight[$1] }
            .prefix(2)

        return ranked.map { bucket in
            let mean = sum[bucket] / weight[bucket]
            return Color(.sRGB, red: mean.x, green: mean.y, blue: mean.z, opacity: 1)
        }
    }
}
