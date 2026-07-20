//
//  TransactionImageIngestion.swift
//  Outlayr
//
//  Turns a picker image + the hero's crop controls into a small, store-safe
//  JPEG. Raw picker bytes are NEVER persisted: the source is cropped to the
//  circular selection's bounding square, downscaled to at most 512pt, and
//  JPEG-encoded under a hard ~300 KB ceiling (quality steps down, then the
//  dimension, until it fits). The circle itself is drawn by the hero's clip —
//  JPEG has no alpha, so a square crop is stored and masked at render time.
//

import CoreGraphics
import UIKit

enum TransactionImageIngestion {
    static let maxDimension: CGFloat = 512
    static let maxBytes = 300 * 1024

    /// How the hero's Zoom/Horizontal/Vertical sliders frame the source. The
    /// envelope is defined once here so the sliders, the clamp, and the docs
    /// can never disagree: `zoom` spans `zoomRange`, offsets span `offsetRange`
    /// as fractions of the crop window.
    struct Crop: Equatable {
        static let zoomRange: ClosedRange<CGFloat> = 1...1.8
        static let offsetRange: ClosedRange<CGFloat> = -0.3...0.3

        var zoom: CGFloat = 1
        var offsetX: CGFloat = 0
        var offsetY: CGFloat = 0

        static let identity = Crop()

        var clamped: Crop {
            Crop(
                zoom: Self.zoomRange.clamp(zoom),
                offsetX: Self.offsetRange.clamp(offsetX),
                offsetY: Self.offsetRange.clamp(offsetY)
            )
        }
    }

    struct Prepared: Equatable {
        let data: Data
        let colour: String
    }

    /// Crops, downscales, and encodes. Returns nil if the image has no drawable
    /// CGImage backing, encoding fails, or no encoding clears the byte ceiling —
    /// callers MUST handle nil (surface an error) rather than store raw bytes.
    static func prepare(_ image: UIImage, crop: Crop = .identity) -> Prepared? {
        guard let rendered = renderCroppedSquare(image, crop: crop.clamped),
              let cg = rendered.cgImage else { return nil }
        guard let data = encodeUnderCeiling(rendered) else { return nil }
        let colour = ImageDominantColors.extract(from: cg).first ?? ""
        return Prepared(data: data, colour: colour)
    }

    /// Draws the selected square region into a target no larger than
    /// `maxDimension`. Works in the source's oriented pixel space via
    /// `UIGraphicsImageRenderer`, so EXIF orientation is baked in.
    private static func renderCroppedSquare(_ image: UIImage, crop: Crop) -> UIImage? {
        let size = image.size
        guard size.width > 0, size.height > 0 else { return nil }

        let shortest = min(size.width, size.height)
        let cropSide = shortest / crop.zoom
        // Centre the window, then slide it by the offsets, clamped inside bounds.
        let maxDX = size.width - cropSide
        let maxDY = size.height - cropSide
        let originX = min(max(0, (size.width - cropSide) / 2 + crop.offsetX * cropSide), max(0, maxDX))
        let originY = min(max(0, (size.height - cropSide) / 2 + crop.offsetY * cropSide), max(0, maxDY))
        let cropRect = CGRect(x: originX, y: originY, width: cropSide, height: cropSide)

        let target = min(cropSide, maxDimension)
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = true
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: target, height: target), format: format)
        return renderer.image { _ in
            // Draw the whole image translated/scaled so `cropRect` fills the target.
            let scale = target / cropSide
            let drawSize = CGSize(width: size.width * scale, height: size.height * scale)
            let drawOrigin = CGPoint(x: -originX * scale, y: -originY * scale)
            image.draw(in: CGRect(origin: drawOrigin, size: drawSize))
        }
    }

    /// How many times the dimension may halve before giving up: 512 → 16pt, far
    /// below anything a real photo needs, so the loop terminates well before it.
    static let maxHalvings = 5

    /// Steps JPEG quality down, then halves the dimension, until the encoding
    /// clears the byte ceiling. The ≤`maxBytes` contract is enforced on EVERY
    /// return, including the last resort: if even the smallest encoding is still
    /// over (only reachable for a pathological source), this returns nil rather
    /// than persist an oversized blob, and `prepare` propagates the nil for the
    /// caller to handle.
    private static func encodeUnderCeiling(_ image: UIImage) -> Data? {
        var current = image
        for _ in 0...maxHalvings {
            for quality in stride(from: 0.7, through: 0.2, by: -0.1) {
                guard let data = current.jpegData(compressionQuality: quality) else { continue }
                if data.count <= maxBytes { return data }
            }
            guard let smaller = downscaleByHalf(current), min(smaller.size.width, smaller.size.height) >= 1 else { break }
            current = smaller
        }
        // Last resort must still clear the ceiling; otherwise refuse to store.
        if let data = current.jpegData(compressionQuality: 0.2), data.count <= maxBytes { return data }
        return nil
    }

    private static func downscaleByHalf(_ image: UIImage) -> UIImage? {
        let newSize = CGSize(width: max(1, image.size.width / 2), height: max(1, image.size.height / 2))
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = true
        let renderer = UIGraphicsImageRenderer(size: newSize, format: format)
        return renderer.image { _ in image.draw(in: CGRect(origin: .zero, size: newSize)) }
    }
}

private extension ClosedRange where Bound == CGFloat {
    func clamp(_ value: Bound) -> Bound {
        Swift.min(upperBound, Swift.max(lowerBound, value))
    }
}
