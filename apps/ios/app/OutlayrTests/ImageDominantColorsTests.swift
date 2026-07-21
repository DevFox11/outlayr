//
//  ImageDominantColorsTests.swift
//  OutlayrTests
//
//  Pins ImageDominantColors against synthetic CGImages: a solid tone yields that
//  hue, a two-tone image yields both, and a desaturated image yields nothing.
//

import CoreGraphics
import XCTest

@testable import Outlayr

final class ImageDominantColorsTests: XCTestCase {
    /// Builds a `side`×`side` opaque image split into vertical bands of the given
    /// RGB colors (0–255), left to right in equal widths.
    private func bandedImage(_ bands: [(Int, Int, Int)], side: Int = 48) -> CGImage {
        var pixels = [UInt8](repeating: 0, count: side * side * 4)
        for y in 0..<side {
            for x in 0..<side {
                let band = min(bands.count - 1, x * bands.count / side)
                let (r, g, b) = bands[band]
                let i = (y * side + x) * 4
                pixels[i] = UInt8(r); pixels[i + 1] = UInt8(g); pixels[i + 2] = UInt8(b); pixels[i + 3] = 255
            }
        }
        let context = CGContext(
            data: &pixels, width: side, height: side, bitsPerComponent: 8, bytesPerRow: side * 4,
            space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        )!
        return context.makeImage()!
    }

    private func rgb(_ hex: String) -> (r: Double, g: Double, b: Double) {
        var value: UInt64 = 0
        Scanner(string: hex.replacingOccurrences(of: "#", with: "")).scanHexInt64(&value)
        return (Double((value >> 16) & 0xFF) / 255, Double((value >> 8) & 0xFF) / 255, Double(value & 0xFF) / 255)
    }

    private func hue(_ hex: String) -> Double {
        let c = rgb(hex)
        let hi = max(c.r, c.g, c.b), lo = min(c.r, c.g, c.b), delta = hi - lo
        guard delta > 0 else { return 0 }
        var h: Double
        if hi == c.r { h = ((c.g - c.b) / delta).truncatingRemainder(dividingBy: 6) } else if hi == c.g { h = (c.b - c.r) / delta + 2 } else { h = (c.r - c.g) / delta + 4 }
        return (h / 6 + 1).truncatingRemainder(dividingBy: 1) * 360
    }

    func testSolidSaturatedImageYieldsThatHue() throws {
        let colors = ImageDominantColors.extract(from: bandedImage([(220, 40, 40)]))
        let first = try XCTUnwrap(colors.first)
        // Red sits near 0°/360°; accept either end of the wrap.
        let h = hue(first)
        XCTAssertTrue(h < 20 || h > 340, "expected red hue, got \(h)° from \(first)")
    }

    func testTwoToneImageYieldsBothDominants() {
        let colors = ImageDominantColors.extract(from: bandedImage([(220, 30, 30), (30, 60, 220)]))
        XCTAssertEqual(colors.count, 2)
        let hues = colors.map(hue).sorted()
        // One red (~0/360), one blue (~240).
        XCTAssertTrue(hues.contains { $0 < 25 || $0 > 335 }, "no red hue in \(hues)")
        XCTAssertTrue(hues.contains { abs($0 - 240) < 40 }, "no blue hue in \(hues)")
    }

    func testDesaturatedImageYieldsNoDominants() {
        // Mid grey: saturation ~0, below the 0.15 floor.
        XCTAssertTrue(ImageDominantColors.extract(from: bandedImage([(128, 128, 128)])).isEmpty)
    }

    func testExtractionIsDeterministic() {
        let image = bandedImage([(200, 50, 90), (40, 180, 120)])
        XCTAssertEqual(ImageDominantColors.extract(from: image), ImageDominantColors.extract(from: image))
    }

    /// A uniform saturated fill has one exact weighted mean — pin the hex so the
    /// determinism claim is a value, not just intra-run equality.
    func testSolidColorPinsExactHex() {
        XCTAssertEqual(ImageDominantColors.extract(from: bandedImage([(200, 50, 90)])), ["#C8325A"])
    }

    func testFullyTransparentImageYieldsNoDominants() {
        let side = 24
        var pixels = [UInt8](repeating: 0, count: side * side * 4) // all zero = transparent
        let context = CGContext(
            data: &pixels, width: side, height: side, bitsPerComponent: 8, bytesPerRow: side * 4,
            space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        )!
        XCTAssertTrue(ImageDominantColors.extract(from: context.makeImage()!).isEmpty)
    }

    func testSinglePixelSaturatedImageIsHandled() {
        // A 1×1 saturated source scales up to the 24×24 sample without crashing
        // and yields its own hue.
        let colors = ImageDominantColors.extract(from: bandedImage([(0, 0, 255)], side: 1))
        XCTAssertEqual(colors, ["#0000FF"])
    }
}
