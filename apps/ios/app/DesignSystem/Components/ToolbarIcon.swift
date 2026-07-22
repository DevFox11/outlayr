import HugeiconsCore
import SwiftUI

/// A bare Hugeicons glyph sized to sit inside a native toolbar button.
///
/// The glyph is rendered as a template image rather than text: toolbars give image
/// labels the native icon-only circular treatment, while text labels get pill-shaped
/// chrome sized to the string's intrinsic width.
struct ToolbarIcon: View {
    typealias Style = HugeiconGlyph.Style

    private let name: String
    private let style: Style
    private let color: Color

    /// The glyph is drawn into a bitmap at a fixed point size, so it has to be
    /// scaled here — unlike a font-backed symbol it will not grow on its own.
    @ScaledMetric private var size: CGFloat

    init(
        _ name: String,
        style: Style = .strokeRounded,
        size: CGFloat = 22,
        color: Color = Color.PrimaryText
    ) {
        self.name = name
        self.style = style
        self.color = color
        _size = ScaledMetric(wrappedValue: size, relativeTo: .body)
    }

    /// Addresses a glyph by codepoint instead of by name.
    ///
    /// Naming is the normal route, but a name only resolves if the bundled font
    /// carries a ligature for it, and some builds ship a glyph without one. The
    /// codepoint reaches the same glyph through the character map, which has no
    /// such gap. Prefer the name wherever it works — a name survives the font
    /// being re-vendored, a codepoint has to be rechecked.
    init(
        codepoint: Unicode.Scalar,
        style: Style = .strokeRounded,
        size: CGFloat = 22,
        color: Color = Color.PrimaryText
    ) {
        name = String(codepoint)
        self.style = style
        self.color = color
        _size = ScaledMetric(wrappedValue: size, relativeTo: .body)
    }

    var body: some View {
        if let image = HugeiconGlyph.image(name, style: style, size: size) {
            Image(uiImage: image)
                .renderingMode(.template)
                .foregroundStyle(color)
        } else {
            HugeiconsText(name, font: style.font(size: size), color: color)
        }
    }
}
