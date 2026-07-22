import SwiftUI

extension View {
    /// Applies a stronger stroke overlay when Increase Contrast is enabled.
    func contrastAdaptiveBorder<S: Shape>(
        _ shape: S,
        color: Color = Color.Outline,
        standardWidth: CGFloat = 1.3,
        increasedWidth: CGFloat = 2.0,
        standardOpacity: Double = 1.0
    ) -> some View {
        modifier(ContrastAdaptiveBorderModifier(
            shape: shape,
            color: color,
            standardWidth: standardWidth,
            increasedWidth: increasedWidth,
            standardOpacity: standardOpacity
        ))
    }
}

private struct ContrastAdaptiveBorderModifier<S: Shape>: ViewModifier {
    let shape: S
    let color: Color
    let standardWidth: CGFloat
    let increasedWidth: CGFloat
    let standardOpacity: Double

    @Environment(\.colorSchemeContrast) private var colorSchemeContrast

    func body(content: Content) -> some View {
        content.overlay(
            shape.stroke(
                color.opacity(colorSchemeContrast == .increased ? 1.0 : standardOpacity),
                lineWidth: colorSchemeContrast == .increased ? increasedWidth : standardWidth
            )
        )
    }
}
