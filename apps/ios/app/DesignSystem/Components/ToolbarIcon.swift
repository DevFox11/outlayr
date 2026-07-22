import HugeiconsCore
import HugeiconsSolidRounded
import HugeiconsStrokeRounded
import SwiftUI
import UIKit

/// A bare Hugeicons glyph sized to sit inside a native toolbar button.
///
/// The glyph is rendered as a template image rather than text: toolbars give image
/// labels the native icon-only circular treatment, while text labels get pill-shaped
/// chrome sized to the string's intrinsic width.
struct ToolbarIcon: View {
    /// Hugeicons ships eleven styles; the app's icon system uses rounded only — stroke
    /// for resting icons, solid for active ones.
    enum Style {
        case strokeRounded
        case solidRounded

        var postScriptName: String? {
            switch self {
            case .strokeRounded: HugeiconsStrokeRounded.load()
            case .solidRounded: HugeiconsSolidRounded.load()
            }
        }

        func font(size: CGFloat) -> HugeiconsFont {
            switch self {
            case .strokeRounded: HugeiconsStrokeRounded.hugeiconsFont(size: size)
            case .solidRounded: HugeiconsSolidRounded.hugeiconsFont(size: size)
            }
        }
    }

    private let name: String
    private let style: Style
    private let size: CGFloat
    private let color: Color

    init(
        _ name: String,
        style: Style = .strokeRounded,
        size: CGFloat = 22,
        color: Color = Color.PrimaryText
    ) {
        self.name = name
        self.style = style
        self.size = size
        self.color = color
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
        self.size = size
        self.color = color
    }

    var body: some View {
        if let image = glyphImage {
            Image(uiImage: image)
                .renderingMode(.template)
                .foregroundStyle(color)
        } else {
            HugeiconsText(name, font: style.font(size: size), color: color)
        }
    }

    /// The font's ligature table maps icon names to glyphs, so drawing the name with
    /// ligatures enabled produces the icon.
    private var glyphImage: UIImage? {
        guard let postScriptName = style.postScriptName,
              let font = UIFont(name: postScriptName, size: size) else { return nil }
        let attributed = NSAttributedString(
            string: name,
            attributes: [.font: font, .ligature: 1]
        )
        let bounds = attributed.boundingRect(
            with: CGSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude),
            options: .usesLineFragmentOrigin,
            context: nil
        )
        guard bounds.width > 0, bounds.height > 0 else { return nil }

        // A resolved ligature collapses the whole name into one roughly square
        // glyph. If the font carries no ligature for the name, the string draws
        // as literal characters instead — far wider than tall, and often blank,
        // since the icon font has no Latin glyphs. That renders as an empty
        // toolbar button with no error, so fail loudly in development.
        // The bundled hgi-stroke-rounded.ttf is missing the calendar-03
        // ligature even though the glyph itself ships at U+F18D3.
        assert(
            bounds.width <= bounds.height * 2,
            "No ligature for Hugeicons name '\(name)' in the bundled font — it would draw as literal text."
        )
        let renderer = UIGraphicsImageRenderer(size: bounds.size)
        return renderer.image { _ in
            attributed.draw(
                with: CGRect(origin: .zero, size: bounds.size),
                options: .usesLineFragmentOrigin,
                context: nil
            )
        }.withRenderingMode(.alwaysTemplate)
    }
}
