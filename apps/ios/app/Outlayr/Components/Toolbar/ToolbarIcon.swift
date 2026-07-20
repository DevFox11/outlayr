import HugeiconsCore
import HugeiconsSolidRounded
import HugeiconsStrokeRounded
import SwiftUI

/// A bare Hugeicons glyph sized to sit inside a native toolbar button.
struct ToolbarIcon: View {
    enum Glyph: UInt32 {
        case view = 0xF2971
        case viewOffSlash = 0xF296D
        case arrowUpDown = 0xF1639
        case plusSign = 0xF235A
        case cancel = 0xF18BC
    }

    /// Hugeicons ships eleven styles; the app's icon system uses rounded only — stroke
    /// for resting icons, solid for active ones.
    enum Style {
        case strokeRounded
        case solidRounded

        func font(size: CGFloat) -> Font {
            switch self {
            case .strokeRounded: HugeiconsStrokeRounded.font(size: size)
            case .solidRounded: HugeiconsSolidRounded.font(size: size)
            }
        }
    }

    private let codepoint: UInt32
    private let style: Style
    private let size: CGFloat
    private let color: Color
    private let pinnedWidth: CGFloat?

    init(
        _ glyph: Glyph,
        style: Style = .strokeRounded,
        size: CGFloat = 22,
        color: Color = Color.PrimaryText,
        pinnedWidth: CGFloat? = nil
    ) {
        self.init(
            codepoint: glyph.rawValue,
            style: style,
            size: size,
            color: color,
            pinnedWidth: pinnedWidth
        )
    }

    init(
        codepoint: UInt32,
        style: Style = .strokeRounded,
        size: CGFloat = 22,
        color: Color = Color.PrimaryText,
        pinnedWidth: CGFloat? = nil
    ) {
        self.codepoint = codepoint
        self.style = style
        self.size = size
        self.color = color
        self.pinnedWidth = pinnedWidth
    }

    var body: some View {
        HugeIcon(
            codepoint: codepoint,
            font: style.font(size: size),
            color: color
        )
        // A toolbar pins button height and flexes width, so a lone icon needs a pinned
        // width of 12 to stay circular. Pinning narrower than the glyph's ink clips it,
        // so default to letting the glyph size itself.
        .frame(width: pinnedWidth, height: pinnedWidth)
    }
}
