//
//  ColourPickerView.swift
//  Outlayr
//

import SwiftUI
import UIKit

/// The colour rail above the icon grid in the category picker panel: the palette
/// as circles, then the system picker for a fully custom colour. Colours already
/// used by other expense categories are dimmed and cannot be re-selected.
struct ColourPickerView: View {
    @Binding var selectedColour: String
    let usedColours: Set<String>

    @State private var customColour: Color

    init(selectedColour: Binding<String>, usedColours: Set<String>) {
        _selectedColour = selectedColour
        self.usedColours = usedColours
        _customColour = State(initialValue: Color(hex: selectedColour.wrappedValue))
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(Color.colorArray, id: \.self) { hex in
                    ColourSwatch(
                        hex: hex,
                        isSelected: selectedColour == hex,
                        isUsed: usedColours.contains(hex)
                    ) {
                        guard selectedColour != hex else { return }
                        UISelectionFeedbackGenerator().selectionChanged()
                        selectedColour = hex
                        customColour = Color(hex: hex)
                    }
                }

                // No selection haptic here: the system picker streams values while the
                // user drags, which would fire a continuous buzz.
                ColorPicker("", selection: $customColour)
                    .labelsHidden()
                    .fixedSize()
                    .onChange(of: customColour) { _, newValue in
                        if let hex = newValue.toHex() {
                            selectedColour = hex
                        }
                    }
                    .accessibilityLabel("Custom colour")
            }
            // The selection ring stands off the circle; without this the first and
            // last rings clip against the scroll view's bounds.
            .padding(.horizontal, 20)
            .padding(.vertical, ColourSwatch.ringInset)
        }
    }
}

private struct ColourSwatch: View {
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
        .accessibilityHint(isDimmed ? "Already used by another category" : "")
    }
}
