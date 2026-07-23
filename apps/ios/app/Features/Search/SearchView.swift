//
//  SearchView.swift
//  Outlayr
//

import SwiftUI

/// Search is a focused modal task rather than a field on the Log. Pinning the
/// field open on the Log itself would force the title inline and cost the large
/// title; a pushed screen with an always-open field loses its back button to the
/// search bar. A sheet keeps the field focused on entry and always offers a way
/// out — the drag indicator, plus dismissing when the field's Cancel is tapped.
struct SearchView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var searchQuery = ""
    @State private var isSearching = true

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                if searchQuery.isEmpty {
                    SearchEmptyState(kind: .idle)
                } else {
                    FilteredSearchView(searchQuery: searchQuery)
                        .padding(.horizontal, 10)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.PrimaryBackground)
            .navigationTitle("Search")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(
                text: $searchQuery,
                isPresented: $isSearching,
                placement: .navigationBarDrawer(displayMode: .always),
                prompt: "Search entry by note"
            )
        }
        .presentationDragIndicator(.visible)
        .onChange(of: isSearching) { _, presented in
            // The search field's Cancel closes the whole task, not just the field.
            if !presented { dismiss() }
        }
    }

}
