//
//  CategoryPickerSheet.swift
//  Outlayr
//
//  Created by Rafael Soh on 20/11/23.
//

import CoreData
import SwiftUI
import UIKit

/// Bottom-sheet category picker: parents render as cards, subcategories as chips inside.
/// Tapping a parent selects the parent; tapping a chip selects that child. Either dismisses.
struct CategoryPickerSheet: View {
    @Binding var category: Category?
    @Binding var showEdit: Bool

    @Environment(\.dismiss) private var dismiss
    @FetchRequest private var parents: FetchedResults<Category>

    init(category: Binding<Category?>, showEdit: Binding<Bool>, income: Bool) {
        _category = category
        _showEdit = showEdit
        _parents = FetchRequest<Category>(
            sortDescriptors: [SortDescriptor(\.order)],
            predicate: NSPredicate(format: "income = %d AND parent == nil", income)
        )
    }

    private let chipColumns = [GridItem(.adaptive(minimum: 110), spacing: 8)]

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 14) {
                    ForEach(parents) { parent in
                        parentCard(parent)
                    }
                }
                .padding()
            }
            .scrollIndicators(.hidden)
            .navigationTitle("Select Category")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        showEdit = true
                        dismiss()
                    } label: {
                        Label("Edit", systemImage: "pencil")
                    }
                }
            }
            .presentationDetents([.medium, .large])
        }
    }

    private func colour(for item: Category) -> Color {
        item.income ? Color.IncomeGreen : Color(hex: item.wrappedColour)
    }

    private func parentCard(_ parent: Category) -> some View {
        let accent = colour(for: parent)
        let isSelected = parent == category

        return VStack(alignment: .leading, spacing: 10) {
            Button {
                select(parent)
            } label: {
                HStack(spacing: 10) {
                    CategoryIconGlyph(symbol: parent.displaySymbol, size: 20)
                        .foregroundStyle(accent)
                    Text(parent.wrappedName)
                        .font(.system(.body, design: .rounded, weight: .semibold))
                        .foregroundStyle(Color.PrimaryText)
                        .lineLimit(1)
                    Spacer()
                    if isSelected {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(.body, design: .rounded, weight: .semibold))
                            .foregroundStyle(accent)
                    }
                }
                .contentShape(.rect)
            }
            .buttonStyle(.plain)

            if parent.hasChildren {
                LazyVGrid(columns: chipColumns, alignment: .leading, spacing: 8) {
                    ForEach(parent.sortedChildren) { child in
                        childChip(child, accent: colour(for: child))
                    }
                }
            }
        }
        .padding(14)
        .background(accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(accent.opacity(isSelected ? 0.9 : 0.3), lineWidth: isSelected ? 2 : 1)
        }
    }

    private func childChip(_ child: Category, accent: Color) -> some View {
        let isSelected = child == category

        return Button {
            select(child)
        } label: {
            HStack(spacing: 6) {
                CategoryIconGlyph(symbol: child.displaySymbol)
                Text(child.wrappedName)
                    .font(.system(.subheadline, design: .rounded, weight: .semibold))
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .foregroundStyle(accent)
            .background(accent.opacity(0.22), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay {
                if isSelected {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .strokeBorder(accent, lineWidth: 2)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }

    private func select(_ item: Category) {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        category = item
        dismiss()
    }
}
