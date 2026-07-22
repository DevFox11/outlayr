//
//  ColorPickerView.swift
//  Outlayr
//

import SwiftUI
import UIKit

/// The color rail above the icon grid in the category picker panel: the palette
/// as circles, then the system picker for a fully custom color. Colors already
/// used by other expense categories are dimmed and cannot be re-selected.
struct ColorPickerView: View {
    @Binding var selectedColor: String
    let usedColors: Set<String>

    @State private var customColor: Color

    init(selectedColor: Binding<String>, usedColors: Set<String>) {
        _selectedColor = selectedColor
        self.usedColors = usedColors
        _customColor = State(initialValue: Color(hex: selectedColor.wrappedValue))
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(Color.colorArray, id: \.self) { hex in
                    ColorSwatch(
                        hex: hex,
                        isSelected: selectedColor == hex,
                        isUsed: usedColors.contains(hex)
                    ) {
                        guard selectedColor != hex else { return }
                        UISelectionFeedbackGenerator().selectionChanged()
                        selectedColor = hex
                        customColor = Color(hex: hex)
                    }
                }

                // No selection haptic here: the system picker streams values while the
                // user drags, which would fire a continuous buzz.
                ColorPicker("", selection: $customColor)
                    .labelsHidden()
                    .fixedSize()
                    .onChange(of: customColor) { _, newValue in
                        if let hex = newValue.toHex() {
                            selectedColor = hex
                        }
                    }
                    .accessibilityLabel(String(localized: "accessibility.customColor"))
            }
            // The selection ring stands off the circle; without this the first and
            // last rings clip against the scroll view's bounds.
            .padding(.horizontal, 20)
            .padding(.vertical, ColorSwatch.ringInset)
        }
    }
}

private struct ColorSwatch: View {
    let hex: String
    let isSelected: Bool
    let isUsed: Bool
    let action: () -> Void

    private static let diameter: CGFloat = 34
    static let ringInset: CGFloat = 3

    private var isDimmed: Bool { isUsed && !isSelected }

    var body: some View {
        Button(action: action) {
            Circle()
                .fill(Color(hex: hex))
                .frame(width: Self.diameter, height: Self.diameter)
                .overlay {
                    if isSelected {
                        Circle()
                            .inset(by: -Self.ringInset)
                            .strokeBorder(Color.PrimaryText, lineWidth: 2)
                    } else if isDimmed {
                        Circle()
                            .strokeBorder(Color.PrimaryText.opacity(0.12), lineWidth: 1)
                    }
                }
                .opacity(isDimmed ? 0.3 : 1)
                .animation(.spring(response: 0.28, dampingFraction: 0.7), value: isSelected)
        }
        .buttonStyle(GridPressStyle(scale: 0.92, pressedOpacity: nil))
        .disabled(isUsed && !isSelected)
        .accessibilityLabel(Text(verbatim: hex))
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
        .accessibilityHint(isDimmed ? String(localized: "accessibility.alreadyUsedByAnotherCategory") : "")
    }
}
