//
//  CategoryAlerts.swift
//  Outlayr
//

import SwiftUI

/// The full category glyph catalogue, grouped by theme, with search.
struct CategoryIconBrowser: View {
    @Binding var selection: String
    let tint: Color
    var query: String = ""
    var headerBackground: Color = .clear

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 10), count: 6)

    private var results: [CategoryIcon] {
        CategoryIconCatalog.icons(matching: query)
    }

    private var isSearching: Bool {
        !query.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        Group {
            if isSearching {
                searchResults
            } else {
                groupedCatalog
            }
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 24)
    }

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
                        .background(headerBackground)
                }
            }
        }
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
        }
    }

    private func grid(for icons: [CategoryIcon]) -> some View {
        LazyVGrid(columns: columns, spacing: 10) {
            ForEach(icons) { icon in
                SymbolIconCell(
                    icon: icon,
                    tint: tint,
                    isSelected: icon.name == selection
                ) {
                    selection = icon.name
                }
            }
        }
    }
}
