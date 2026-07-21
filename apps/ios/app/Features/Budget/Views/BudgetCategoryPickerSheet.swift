//
//  BudgetCategoryPickerSheet.swift
//  Outlayr
//
//  Created by Rafael Soh on 15/7/23.
//

import CoreData
import SwiftUI

struct BudgetCategoryPickerSheet: View {
    @Binding var selectedCategory: Category?
    @Environment(\.dismiss) private var dismiss
    @FetchRequest private var categories: FetchedResults<Category>
    @State private var search = ""

    private let columns = [
        GridItem(.flexible(), spacing: 10),
        GridItem(.flexible(), spacing: 10)
    ]

    init(selectedCategory: Binding<Category?>) {
        _selectedCategory = selectedCategory
        let budgetPredicate = NSPredicate(format: "%K == nil", #keyPath(Category.budget))
        let incomePredicate = NSPredicate(format: "income = %d", false)
        _categories = FetchRequest(
            sortDescriptors: [SortDescriptor(\.order)],
            predicate: NSCompoundPredicate(type: .and, subpredicates: [budgetPredicate, incomePredicate])
        )
    }

    private var isSearching: Bool {
        !search.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private var filtered: [Category] {
        let query = search.trimmingCharacters(in: .whitespaces).lowercased()
        guard !query.isEmpty else { return Array(categories) }
        return categories.filter { $0.wrappedName.lowercased().contains(query) }
    }

    private var recentCategories: [Category] {
        Array(categories)
            .filter { $0.transactionCount > 0 }
            .sorted { ($0.allTransactions.last?.wrappedDate ?? .distantPast) > ($1.allTransactions.last?.wrappedDate ?? .distantPast) }
            .prefix(6)
            .map { $0 }
    }

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                LazyVStack(alignment: .leading, spacing: 22, pinnedViews: []) {
                    if !isSearching && !recentCategories.isEmpty {
                        gridSection("Recent", recentCategories)
                    }

                    if filtered.isEmpty {
                        emptyResults
                    } else {
                        gridSection(isSearching ? "Results" : "All Categories", filtered)
                    }
                }
                .padding(20)
            }
            .background(Color.PrimaryBackground)
            .navigationTitle("Choose Category")
            .navigationBarTitleDisplayMode(.inline)
            .tint(Color.PrimaryText)
            .searchable(text: $search, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search categories")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private func gridSection(_ title: LocalizedStringKey, _ items: [Category]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.system(.subheadline, design: .rounded).weight(.semibold))
                .foregroundStyle(Color.SubtitleText)

            LazyVGrid(columns: columns, spacing: 10) {
                ForEach(items, id: \.self) { category in
                    tile(category)
                }
            }
        }
    }

    private func tile(_ category: Category) -> some View {
        let colour = Color(hex: category.wrappedColour)
        let selected = selectedCategory == category

        return Button {
            selectedCategory = category
            dismiss()
        } label: {
            HStack(spacing: 7) {
                CategoryIconGlyph(symbol: category.displaySymbol)
                    .foregroundStyle(colour)
                Text(category.wrappedName)
                    .font(.system(.body, design: .rounded).weight(.semibold))
                    .lineLimit(1)
                Spacer(minLength: 0)
                if selected {
                    Image(systemName: "checkmark")
                        .font(.system(.footnote, design: .rounded).weight(.bold))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 12)
            .padding(.vertical, 12)
            .foregroundStyle(colour)
            .background(colour.opacity(0.3), in: RoundedRectangle(cornerRadius: 13, style: .continuous))
            .overlay {
                if selected {
                    RoundedRectangle(cornerRadius: 13, style: .continuous)
                        .strokeBorder(colour, lineWidth: 2)
                }
            }
        }
        .buttonStyle(BouncyButton(duration: 0.2, scale: 0.94))
    }

    private var emptyResults: some View {
        VStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(.title, design: .rounded))
                .foregroundStyle(Color.SubtitleText.opacity(0.6))
            Text("No categories found")
                .font(.system(.subheadline, design: .rounded).weight(.medium))
                .foregroundStyle(Color.SubtitleText)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 60)
    }
}
