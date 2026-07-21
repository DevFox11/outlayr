//
//  CurvedText.swift
//  outlayr
//
//  Lays a string along a circular arc, rotating each glyph to follow the curve.
//  Vendored, trimmed replacement for the CrookedText package
//  (github.com/duemunk/CrookedText, MIT © Tobias Due Munk), reduced to the one
//  configuration the budget ring needs: centered alignment, no kerning, with
//  font and color inherited from the environment. The per-glyph arc geometry is
//  preserved verbatim so the ring label renders identically.
//

import SwiftUI

struct CurvedText: View {
    let text: String
    let radius: CGFloat

    @State private var sizes: [CGSize] = []

    var body: some View {
        ZStack {
            ForEach(characters) { item in
                MeasuredGlyph(character: item.string)
                    .frame(width: size(at: item.index).width,
                           height: size(at: item.index).height)
                    .offset(y: -radius)
                    .rotationEffect(angle(at: item.index))
            }
        }
        .frame(width: radius * 2, height: radius * 2)
        .onPreferenceChange(CurvedTextSizeKey.self) { sizes in
            self.sizes = sizes
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(text))
    }

    private var characters: [IdentifiableCharacter] {
        text.enumerated().map(IdentifiableCharacter.init)
    }

    private func size(at index: Int) -> CGSize {
        sizes[safe: index] ?? CGSize(width: 1_000_000, height: 0)
    }

    private func angle(at index: Int) -> Angle {
        let letterWidths = sizes.map { $0.width }
        let prevWidth = index < letterWidths.count
            ? letterWidths.dropLast(letterWidths.count - index).reduce(0, +)
            : 0
        let prevArcWidth = Double(prevWidth / radius)
        let totalArcWidth = Double(letterWidths.reduce(0, +) / radius)
        let charWidth = letterWidths[safe: index] ?? 0
        let charOffset = Double(charWidth / 2 / radius)
        let arcCharCenteringOffset = -totalArcWidth / 2
        return Angle(radians: prevArcWidth + charOffset + arcCharCenteringOffset)
    }
}

private struct IdentifiableCharacter: Identifiable {
    let index: Int
    let character: Character

    var id: String { "\(index) \(character)" }
    var string: String { "\(character)" }
}

private struct MeasuredGlyph: View {
    let character: String

    var body: some View {
        GeometryReader { _ in
            Text(character)
                .background(GeometryReader { proxy in
                    Color.clear.preference(key: CurvedTextSizeKey.self, value: [proxy.size])
                })
        }
    }
}

private struct CurvedTextSizeKey: PreferenceKey {
    static var defaultValue: [CGSize] { [] }
    static func reduce(value: inout [CGSize], nextValue: () -> [CGSize]) {
        value.append(contentsOf: nextValue())
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
