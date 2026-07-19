//
//  IconPickerView.swift
//  Outlayr
//

import HugeiconsCore
import HugeiconsSolidRounded
import SwiftUI

/// The full category glyph catalogue, grouped by theme. Picking an icon commits
/// the selection and closes the sheet.
struct IconPickerView: View {
    @Binding var selection: String
    let tint: Color

    @Environment(\.dismiss) private var dismiss
    @State private var query = ""

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 10), count: 6)

    private var results: [CategoryIcon] {
        CategoryIconCatalog.icons(matching: query)
    }

    private var isSearching: Bool {
        !query.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                if isSearching {
                    searchResults
                } else {
                    groupedCatalog
                }
            }
            .contentMargins(.top, 16, for: .scrollContent)
            .background(Color.PrimaryBackground)
            .navigationTitle("Choose Icon")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .searchable(text: $query, placement: .automatic, prompt: Text("Search icons"))
        }
    }

    @ViewBuilder
    private var groupedCatalog: some View {
        LazyVStack(alignment: .leading, spacing: 20, pinnedViews: .sectionHeaders) {
            ForEach(CategoryIconCatalog.groups) { group in
                Section {
                    grid(for: group.icons)
                } header: {
                    Text(LocalizedStringKey(group.title))
                        .font(.system(.subheadline, design: .rounded, weight: .semibold))
                        .foregroundStyle(Color.SubtitleText)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 8)
                        .background(Color.PrimaryBackground)
                }
            }
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 24)
    }

    @ViewBuilder
    private var searchResults: some View {
        if results.isEmpty {
            Text("No icons found")
                .font(.system(.subheadline, design: .rounded))
                .foregroundStyle(Color.SubtitleText)
                .frame(maxWidth: .infinity)
                .padding(.top, 60)
        } else {
            grid(for: results)
                .padding(.horizontal, 20)
                .padding(.bottom, 24)
        }
    }

    private func grid(for icons: [CategoryIcon]) -> some View {
        LazyVGrid(columns: columns, spacing: 10) {
            ForEach(icons) { icon in
                IconCell(
                    icon: icon,
                    tint: tint,
                    isSelected: icon.name == selection
                ) {
                    selection = icon.name
                    dismiss()
                }
            }
        }
    }
}

private struct IconCell: View {
    let icon: CategoryIcon
    let tint: Color
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(isSelected ? tint.opacity(0.18) : Color.SecondaryBackground)
                .aspectRatio(1, contentMode: .fit)
                .overlay {
                    HugeIcon(
                        codepoint: icon.codepoint,
                        font: HugeiconsSolidRounded.font(size: 20),
                        color: isSelected ? tint : Color.SubtitleText
                    )
                }
                .overlay {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .strokeBorder(tint, lineWidth: isSelected ? 2 : 0)
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(verbatim: icon.name))
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}
