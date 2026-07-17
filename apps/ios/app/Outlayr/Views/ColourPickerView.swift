//
//  ColourPickerView.swift
//  Outlayr
//

import SwiftUI

/// A native swatch grid for choosing a category colour, plus a system
/// `ColorPicker` for a fully custom colour. Colours already used by other
/// expense categories are dimmed and cannot be re-selected.
struct ColourPickerView: View {
    @Binding var selectedColour: String
    let usedColours: Set<String>

    @State private var customColour: Color

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 10), count: 6)

    init(selectedColour: Binding<String>, usedColours: Set<String>) {
        _selectedColour = selectedColour
        self.usedColours = usedColours
        _customColour = State(initialValue: Color(hex: selectedColour.wrappedValue))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            LazyVGrid(columns: columns, spacing: 10) {
                ForEach(Color.colorArray, id: \.self) { hex in
                    ColourSwatch(
                        hex: hex,
                        isSelected: selectedColour == hex,
                        isUsed: usedColours.contains(hex)
                    ) {
                        selectedColour = hex
                        customColour = Color(hex: hex)
                    }
                }
            }

            ColorPicker("Custom Colour", selection: $customColour)
                .font(.system(.body, design: .rounded, weight: .medium))
                .onChange(of: customColour) { _, newValue in
                    if let hex = newValue.toHex() {
                        selectedColour = hex
                    }
                }
        }
    }
}

private struct ColourSwatch: View {
    let hex: String
    let isSelected: Bool
    let isUsed: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            RoundedRectangle(cornerRadius: 9, style: .continuous)
                .fill(Color(hex: hex))
                .aspectRatio(1, contentMode: .fit)
                .overlay {
                    if isSelected {
                        Image(systemName: "checkmark")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(Color(hex: hex).luminance() > 0.5 ? .black : .white)
                    }
                }
                .opacity(isUsed && !isSelected ? 0.25 : 1)
        }
        .buttonStyle(.plain)
        .disabled(isUsed && !isSelected)
        .accessibilityLabel(Text(verbatim: hex))
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}
