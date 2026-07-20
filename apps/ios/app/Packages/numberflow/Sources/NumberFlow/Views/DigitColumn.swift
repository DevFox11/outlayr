import SwiftUI

/// One digit slot: all wheel glyphs stacked in a single line box, each translated by
/// its cylindrical offset from the shared scroll position. Off-window glyphs park at
/// ±1.5 rows and disappear under the container mask.
struct DigitColumn: View {
    let position: Double
    var wheel: Int = 10

    var body: some View {
        Text(verbatim: "8")
            .hidden()
            .overlay {
                GeometryReader { proxy in
                    ZStack(alignment: .topLeading) {
                        ForEach(0..<wheel, id: \.self) { glyph in
                            Text(verbatim: String(glyph))
                                .fixedSize()
                                .frame(width: proxy.size.width, height: proxy.size.height)
                                .modifier(RollOffset(
                                    position: position,
                                    glyph: glyph,
                                    wheel: wheel,
                                    lineHeight: proxy.size.height
                                ))
                        }
                    }
                }
            }
    }
}
