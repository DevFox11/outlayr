//
//  TransactionCategorySheet.swift
//  Outlayr
//
//  Hierarchical category picker for the add/edit transaction form. Parents are
//  fetched sorted by `order`, filtered to the current expense/income mode with
//  `parent == nil` (unlike the old flat, unsorted fetch in TransactionView).
//  Parents with children expand to indented children; both a parent and any
//  child are selectable, marked with a checkmark. Presented as a `.sheet`.
//

import CoreData
import SwiftUI

struct TransactionCategorySheet: View {
    @Binding var category: Category?
    let income: Bool

    @Environment(\.dismiss) private var dismiss
    @FetchRequest private var parents: FetchedResults<Category>
    @State private var expanded: Set<NSManagedObjectID> = []

    init(category: Binding<Category?>, income: Bool) {
        _category = category
        self.income = income
        _parents = FetchRequest(fetchRequest: Category.transactionPickerFetchRequest(income: income))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 10) {
                    ForEach(parents) { parent in
                        parentGroup(parent)
                    }
                }
                .padding(16)
            }
            .scrollIndicators(.hidden)
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Category")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .font(.body.weight(.semibold))
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    @ViewBuilder
    private func parentGroup(_ parent: Category) -> some View {
        let isExpanded = expanded.contains(parent.objectID)
        VStack(spacing: 0) {
            // The row always SELECTS the parent (both levels are selectable); the
            // chevron is its own tap target that only toggles expansion.
            categoryRow(
                parent,
                isChild: false,
                chevron: parent.hasChildren ? isExpanded : nil,
                onSelect: { select(parent) },
                onToggle: { toggle(parent) }
            )

            if parent.hasChildren, isExpanded {
                ForEach(parent.sortedChildren) { child in
                    Divider().overlay(Color.PrimaryText.opacity(0.07)).padding(.leading, 58)
                    categoryRow(child, isChild: true, chevron: nil, onSelect: { select(child) }, onToggle: {})
                }
            }
        }
        .background(Color.SecondaryBackground, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    /// `chevron` is nil for rows with no children, else the expanded state.
    private func categoryRow(
        _ item: Category,
        isChild: Bool,
        chevron: Bool?,
        onSelect: @escaping () -> Void,
        onToggle: @escaping () -> Void
    ) -> some View {
        let isSelected = item == category
        let tint = item.income ? Color.IncomeGreen : Color(hex: item.wrappedColor)

        return HStack(spacing: 12) {
            Button(action: onSelect) {
                HStack(spacing: 12) {
                    CategoryIconTile(symbol: item.displaySymbol, tint: tint, size: .small)

                    Text(item.wrappedName)
                        .font(.system(isChild ? .subheadline : .body, design: .rounded, weight: .medium))
                        .foregroundStyle(Color.PrimaryText)
                        .lineLimit(1)

                    Spacer(minLength: 0)

                    if isSelected {
                        Image(systemName: "checkmark")
                            .font(.system(size: 15, weight: .bold, design: .rounded))
                            .foregroundStyle(Color.IncomeGreen)
                    }
                }
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(item.wrappedName)
            .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)

            if let isExpanded = chevron {
                Button(action: onToggle) {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.SubtitleText)
                        .rotationEffect(.degrees(isExpanded ? 90 : 0))
                        .frame(width: 36, height: 36)
                        .contentShape(.rect)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(isExpanded ? "Collapse \(item.wrappedName)" : "Expand \(item.wrappedName)")
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, isChild ? 9 : 11)
        .padding(.leading, isChild ? 16 : 0)
    }

    private func toggle(_ parent: Category) {
        withAnimation(.easeInOut(duration: 0.25)) {
            if expanded.contains(parent.objectID) {
                expanded.remove(parent.objectID)
            } else {
                expanded.insert(parent.objectID)
            }
        }
    }

    private func select(_ item: Category) {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        category = item
        dismiss()
    }
}

#Preview("Category sheet") {
    struct Demo: View {
        @State private var category: Category?
        var body: some View {
            Color(.systemGroupedBackground)
                .sheet(isPresented: .constant(true)) {
                    TransactionCategorySheet(category: $category, income: false)
                }
        }
    }
    return Demo()
}
