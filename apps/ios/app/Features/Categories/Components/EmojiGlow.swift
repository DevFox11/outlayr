//
//  CategoryIconTile.swift
//  Outlayr
//

import HugeiconsCore
import HugeiconsSolidRounded
import SwiftUI
import UIKit

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
