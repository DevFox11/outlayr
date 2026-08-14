import ExpoModulesCore
import ExpoUI
import UIKit

public class GlowModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Glow")

    Function("fromEmoji") { (emoji: String) -> [String] in
      GlowExtractor.colors(fromEmoji: emoji)
    }

    AsyncFunction("fromImage") { (uri: String) -> [String] in
      GlowExtractor.colors(fromImageURI: uri)
    }

    ExpoUIView(TintedLabelView.self)
  }
}

/// Extracts the up-to-two dominant hues (`#RRGGBB`, most-present first) of a
/// source by rasterizing it into a small buffer and histogramming its colors —
/// a 1:1 port of the Swift app's `EmojiGlow`. The histogram is source-agnostic:
/// a glyph and a photo fill the same buffer and run through the same buckets.
private enum GlowExtractor {
  private static let side = 24

  static func colors(fromEmoji emoji: String) -> [String] {
    extract { context in
      UIGraphicsPushContext(context)
      NSAttributedString(
        string: emoji,
        attributes: [.font: UIFont.systemFont(ofSize: CGFloat(side) * 0.85)]
      ).draw(at: .zero)
      UIGraphicsPopContext()
    }
  }

  static func colors(fromImageURI uri: String) -> [String] {
    guard let cgImage = loadCGImage(uri: uri) else { return [] }
    return extract { context in
      context.interpolationQuality = .high
      context.draw(
        cgImage,
        in: CGRect(x: 0, y: 0, width: CGFloat(side), height: CGFloat(side))
      )
    }
  }

  /// Runs `draw` into a fresh `side × side` RGBA context, then histograms it.
  private static func extract(_ draw: (CGContext) -> Void) -> [String] {
    var pixels = [UInt8](repeating: 0, count: side * side * 4)
    guard
      let context = CGContext(
        data: &pixels,
        width: side,
        height: side,
        bitsPerComponent: 8,
        bytesPerRow: side * 4,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
      )
    else { return [] }

    draw(context)
    return histogram(pixels)
  }

  private static func histogram(_ pixels: [UInt8]) -> [String] {
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

    let ranked =
      weight.indices
      .filter { weight[$0] > 0 }
      .sorted { weight[$0] > weight[$1] }
      .prefix(2)

    return ranked.map { bucket in
      let mean = sum[bucket] / weight[bucket]
      return String(
        format: "#%02X%02X%02X",
        Int((mean.x * 255).rounded()),
        Int((mean.y * 255).rounded()),
        Int((mean.z * 255).rounded())
      )
    }
  }

  private static func loadCGImage(uri: String) -> CGImage? {
    let path: String
    if let url = URL(string: uri), url.isFileURL {
      path = url.path
    } else if uri.hasPrefix("file://") {
      path = String(uri.dropFirst("file://".count))
    } else {
      path = uri
    }
    return UIImage(contentsOfFile: path)?.cgImage
  }
}
