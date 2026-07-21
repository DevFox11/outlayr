//
//  ImageDominantColors.swift
//  Outlayr
//
//  Extracts an image's dominant hues so the transaction glow can bloom in the
//  logo's own colors — the same 12-bucket hue histogram `EmojiGlow` runs on a
//  rendered emoji, lifted to arbitrary CGImages. Deterministic: the same pixels
//  always yield the same hexes, so it can be pinned in tests.
//

import CoreGraphics
import Foundation

enum ImageDominantColors {
    /// The side the image is downscaled to before histogramming. Small enough
    /// to be cheap and stable, large enough to survive a logo's accents.
    static let sampleSide = 24

    /// Up to two dominant colors, most-present first, as `#RRGGBB`. Empty when
    /// the image carries no saturated, opaque ink (callers fall back to a tint).
    static func extract(from image: CGImage) -> [String] {
        let side = sampleSide
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

        context.draw(image, in: CGRect(x: 0, y: 0, width: side, height: side))

        let buckets = 12
        var weight = [Double](repeating: 0, count: buckets)
        var sum = [SIMD3<Double>](repeating: .zero, count: buckets)

        for i in stride(from: 0, to: pixels.count, by: 4) {
            let a = Double(pixels[i + 3]) / 255
            guard a > 0.5 else { continue }
            // Un-premultiply so translucent edges don't drift toward black.
            let r = Double(pixels[i]) / 255 / a
            let g = Double(pixels[i + 1]) / 255 / a
            let b = Double(pixels[i + 2]) / 255 / a

            let hi = max(r, g, b), lo = min(r, g, b)
            let saturation = hi == 0 ? 0 : (hi - lo) / hi
            guard saturation > 0.15, hi > 0.15 else { continue }

            let delta = hi - lo
            var hue: Double
            if delta == 0 {
                hue = 0
            } else if hi == r {
                hue = ((g - b) / delta).truncatingRemainder(dividingBy: 6)
            } else if hi == g {
                hue = (b - r) / delta + 2
            } else {
                hue = (r - g) / delta + 4
            }
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
            return hex(mean)
        }
    }

    private static func hex(_ c: SIMD3<Double>) -> String {
        func channel(_ v: Double) -> Int { min(255, max(0, Int((v * 255).rounded()))) }
        return String(format: "#%02X%02X%02X", channel(c.x), channel(c.y), channel(c.z))
    }
}
