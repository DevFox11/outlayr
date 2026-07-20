import SwiftUI

/// Positions one wheel glyph by its signed modular distance from the animated scroll
/// position. A `GeometryEffect` so that per-frame animation re-evaluates only the
/// transform — the glyph `Text` bodies are built once, never per frame.
struct RollOffset: GeometryEffect {
    var position: Double
    let glyph: Int
    let wheel: Int
    let lineHeight: CGFloat

    var animatableData: Double {
        get { position }
        set { position = newValue }
    }

    func effectValue(size: CGSize) -> ProjectionTransform {
        let offset = DigitWheel.clampedOffset(glyph: glyph, position: position, wheel: wheel)
        return ProjectionTransform(CGAffineTransform(translationX: 0, y: offset * lineHeight))
    }
}
