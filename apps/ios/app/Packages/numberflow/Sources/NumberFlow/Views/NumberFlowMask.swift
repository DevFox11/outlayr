import SwiftUI

/// Fade edges for glyphs entering/leaving the line box. The vertical and horizontal
/// gradients are applied as nested masks — mask alpha multiplies, which yields the
/// correct corner falloff without the web build's corner-radial workaround. Padding
/// gives the fade somewhere to live; the negative padding hands the space back so
/// surrounding layout is unaffected.
struct NumberFlowMask: ViewModifier {
    @ScaledMetric(relativeTo: .body) private var fadeHeight: CGFloat = 4
    @ScaledMetric(relativeTo: .body) private var fadeWidth: CGFloat = 8

    func body(content: Content) -> some View {
        content
            .padding(.vertical, fadeHeight)
            .padding(.horizontal, fadeWidth)
            .compositingGroup()
            .mask { fadeGradient(vertical: true) }
            .mask { fadeGradient(vertical: false) }
            .padding(.vertical, -fadeHeight)
            .padding(.horizontal, -fadeWidth)
    }

    private func fadeGradient(vertical: Bool) -> some View {
        GeometryReader { proxy in
            let total = vertical ? proxy.size.height : proxy.size.width
            let fade = vertical ? fadeHeight : fadeWidth
            let edge = total > 0 ? min(fade / total, 0.5) : 0
            LinearGradient(
                stops: [
                    .init(color: .clear, location: 0),
                    .init(color: .black, location: edge),
                    .init(color: .black, location: 1 - edge),
                    .init(color: .clear, location: 1)
                ],
                startPoint: vertical ? .top : .leading,
                endPoint: vertical ? .bottom : .trailing
            )
        }
    }
}
