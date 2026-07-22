import HugeiconsCore
import HugeiconsSolidRounded
import HugeiconsStrokeRounded
import SwiftUI
import UIKit

/// Draws a Hugeicons glyph as a template image.
///
/// Rendering to an image rather than text matters in two places: toolbars give
/// image labels the native icon-only circular treatment while text labels get
/// pill chrome, and menu rows accept an image but not arbitrary text styling.
enum HugeiconGlyph {
    /// Hugeicons ships eleven styles; the app's icon system uses rounded only —
    /// stroke for resting icons, solid for active ones and menu rows.
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

    /// The font's ligature table maps icon names to glyphs, so drawing the name
    /// with ligatures enabled produces the icon. A codepoint passed as a
    /// single-scalar string resolves through the character map instead, which
    /// is the escape hatch when a build ships a glyph without its ligature.
    static func image(_ name: String, style: Style, size: CGFloat) -> UIImage? {
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

        // Without a ligature the name draws as literal characters, which an icon
        // font renders as nothing — an invisible control and no error.
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
