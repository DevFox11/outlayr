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
