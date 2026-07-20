import Foundation

/// Cylindrical wheel math: every glyph is positioned by its signed modular distance
/// from an unbounded virtual scroll position, so the wheel wraps both ways and
/// interrupted rolls accumulate naturally.
public enum DigitWheel {
    /// Signed offset of `glyph` from scroll position `position`, in rows,
    /// mapped into `[-wheel/2, wheel/2)`. Positive is below the visible glyph.
    public static func signedOffset(glyph: Int, position: Double, wheel: Int = 10) -> Double {
        let length = Double(wheel)
        var raw = (Double(glyph) - position).truncatingRemainder(dividingBy: length)
        if raw < 0 { raw += length }
        return raw >= length / 2 ? raw - length : raw
    }

    /// `signedOffset` clamped to ±1.5 rows so off-screen glyphs park just outside
    /// the visible window instead of being translated far away.
    public static func clampedOffset(glyph: Int, position: Double, wheel: Int = 10) -> Double {
        min(max(signedOffset(glyph: glyph, position: position, wheel: wheel), -1.5), 1.5)
    }
}
