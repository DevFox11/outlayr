//
//  SearchView.swift
//  Outlayr
//

import SwiftUI

/// Search is its own destination rather than a field on the Log. Pinning the
/// field open on the Log would force its title inline and cost the large title;
/// here an always-visible field is the whole point of the screen.
struct SearchView: View {
    let bottomEdge: CGFloat

    @State private var searchQuery = ""
    @State private var isSearching = true

    var body: some View {
        ScrollView(showsIndicators: false) {
            if searchQuery.isEmpty {
                idleState
            } else {
                FilteredSearchView(searchQuery: searchQuery)
                    .padding(.horizontal, 10)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .contentMargins(.bottom, 70 + bottomEdge, for: .scrollContent)
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

    private var idleState: some View {
        VStack(spacing: 12) {
            MonoLabel(verbatim: String(localized: "SEARCH"))

            Text("Find an entry by its note.")
                .font(.system(.subheadline, design: .rounded).weight(.medium))
                .foregroundStyle(Color.SubtitleText)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 280)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 32)
        .padding(.top, 80)
    }
}
