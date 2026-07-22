//
//  TransactionImageIngestionTests.swift
//  OutlayrTests
//
//  Pins the store-safety contract: a large, hard-to-compress source is always
//  reduced to a JPEG no larger than 512pt on a side and under the ~300 KB
//  ceiling. Raw picker bytes must never reach the store.
//

import UIKit
import Testing

@testable import Outlayr

struct TransactionImageIngestionTests {
    /// A `w`×`h` opaque image of high-frequency color noise — the worst case
    /// for JPEG, so the byte ceiling is exercised honestly. Deterministic.
    private func noisyImage(width: Int, height: Int) -> UIImage {
        var pixels = [UInt8](repeating: 0, count: width * height * 4)
        for y in 0..<height {
            for x in 0..<width {
                let i = (y * width + x) * 4
                pixels[i] = UInt8((x * 31 + y * 17) & 0xFF)
                pixels[i + 1] = UInt8((x * 13 + y * 53 + x * y) & 0xFF)
                pixels[i + 2] = UInt8((x * 71 + y * 29) & 0xFF)
                pixels[i + 3] = 255
            }
        }
        let context = CGContext(
            data: &pixels, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
            space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        )!
        return UIImage(cgImage: context.makeImage()!)
    }

    @Test func largeNoisySourceIsCappedInSizeAndBytes() throws {
        let prepared = try #require(TransactionImageIngestion.prepare(noisyImage(width: 1600, height: 1200)))

        // JPEG magic bytes.
        #expect(Array(prepared.data.prefix(3)) == [0xFF, 0xD8, 0xFF])

        // Under the ceiling.
        #expect(prepared.data.count <= TransactionImageIngestion.maxBytes)

        // Both dimensions within the cap.
        let decoded = try #require(UIImage(data: prepared.data))
        #expect(decoded.size.width * decoded.scale <= TransactionImageIngestion.maxDimension)
        #expect(decoded.size.height * decoded.scale <= TransactionImageIngestion.maxDimension)
    }

    @Test func cropProducesASquare() throws {
        let prepared = try #require(
            TransactionImageIngestion.prepare(noisyImage(width: 900, height: 600), crop: .init(zoom: 1.4, offsetX: 0.1, offsetY: -0.1))
        )
        let decoded = try #require(UIImage(data: prepared.data))
        #expect(abs(decoded.size.width * decoded.scale - decoded.size.height * decoded.scale) < 1)
    }

    @Test func cropClampsOutOfRangeValues() {
        // Extreme slider values must not crash or escape the source bounds.
        let crop = TransactionImageIngestion.Crop(zoom: 9, offsetX: 5, offsetY: -5).clamped
        #expect(abs(crop.zoom - 1.8) < 0.0001)
        #expect(abs(crop.offsetX - 0.3) < 0.0001)
        #expect(abs(crop.offsetY - (-0.3)) < 0.0001)
    }

    @Test func preparedColorIsAHexOrEmpty() throws {
        let prepared = try #require(TransactionImageIngestion.prepare(noisyImage(width: 300, height: 300)))
        if !prepared.color.isEmpty {
            #expect(prepared.color.hasPrefix("#"))
            #expect(prepared.color.count == 7)
        }
    }

    @Test func degenerateSinglePixelSourceStillProducesValidJpeg() throws {
        let prepared = try #require(TransactionImageIngestion.prepare(noisyImage(width: 1, height: 1)))
        #expect(Array(prepared.data.prefix(3)) == [0xFF, 0xD8, 0xFF])
        #expect(prepared.data.count <= TransactionImageIngestion.maxBytes)
    }

    /// A rotated source must crop square in oriented space, not transpose: a
    /// landscape CGImage tagged `.right` (portrait when oriented) still yields a
    /// square JPEG within the cap.
    @Test func exifRotatedSourceIsNotTransposed() throws {
        let landscape = noisyImage(width: 800, height: 400)
        let rotated = UIImage(cgImage: landscape.cgImage!, scale: 1, orientation: .right)
        let prepared = try #require(TransactionImageIngestion.prepare(rotated))
        let decoded = try #require(UIImage(data: prepared.data))
        #expect(abs(decoded.size.width * decoded.scale - decoded.size.height * decoded.scale) < 1)
        #expect(decoded.size.width * decoded.scale <= TransactionImageIngestion.maxDimension)
    }
}
