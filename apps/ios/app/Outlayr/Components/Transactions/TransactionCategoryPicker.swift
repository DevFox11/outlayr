//
//  TransactionCategoryPicker.swift
//  Outlayr
//
//  Created by Rafael Soh on 20/11/23.
//

import CoreData
import SwiftUI
import UIKit

struct NewCategoryPickerView: View {
    @Binding var category: Category?
    @Binding var showPicker: Bool
    @Binding var showingCategoryView: Bool
    @FetchRequest private var parents: FetchedResults<Category>

    private let layout = [
        GridItem(.flexible(), spacing: 10),
        GridItem(.flexible())
    ]

    init(
        category: Binding<Category?>?, showPicker: Binding<Bool>, showSheet: Binding<Bool>,
        income: Bool
    ) {
        _parents = FetchRequest<Category>(
            sortDescriptors: [SortDescriptor(\.order)],
            predicate: NSPredicate(format: "income = %d AND parent == nil", income)
        )
        _category = category ?? Binding.constant(nil)
        _showPicker = showPicker
        _showingCategoryView = showSheet
    }

    var body: some View {
        ScrollView {
            LazyVGrid(columns: layout, spacing: 10) {
                ForEach(parents) { parent in
                    Section {
                        chip(for: parent, isChild: false)
                        ForEach(parent.sortedChildren) { child in
                            chip(for: child, isChild: true)
                        }
                    }
                }
            }
        }
        .scrollIndicators(.hidden)
        .keyboardAwareHeight(showToolbar: false)
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .overlay(alignment: .bottom) { editButton }
    }

    private func chip(for item: Category, isChild: Bool) -> some View {
        CategoryChip(
            symbol: item.displaySymbol,
            name: item.wrappedName,
            colourHex: item.wrappedColour,
            isChild: isChild,
            isSelected: item == category,
            isDimmed: category != nil && category != item
        ) {
            select(item)
        }
    }

    private var editButton: some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            showPicker = false
            showingCategoryView = true
        } label: {
            Label("Edit", systemImage: "pencil")
                .font(.system(.body, design: .rounded, weight: .semibold))
                .foregroundStyle(Color.SubtitleText)
                .padding(.vertical, 9)
                .padding(.horizontal, 18)
                .background(
                    Color.SecondaryBackground,
                    in: RoundedRectangle(cornerRadius: 11.5, style: .continuous)
                )
        }
        .buttonStyle(.plain)
        .padding(.bottom, 15)
    }

    private func select(_ item: Category) {
        withAnimation { category = item }
        Task {
            try? await Task.sleep(for: .seconds(0.5))
            withAnimation { showPicker = false }
        }
    }
}

private struct CategoryChip: View {
    let symbol: CategorySymbol
    let name: String
    let colourHex: String
    let isChild: Bool
    let isSelected: Bool
    let isDimmed: Bool
    let action: () -> Void

    @Environment(\.colorScheme) private var colorScheme

    private var colour: Color { Color(hex: colourHex) }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 7) {
                if isChild {
                    Image(systemName: "arrow.turn.down.right")
                        .font(.system(.caption2, design: .rounded, weight: .semibold))
                        .opacity(0.7)
                }
                CategoryIconGlyph(symbol: symbol)
                Text(name)
                    .font(.system(isChild ? .subheadline : .body, design: .rounded, weight: .semibold))
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 11)
            .padding(.vertical, isChild ? 7 : 9)
            .foregroundStyle(
                CategoryTileShading.glyph(for: colour, in: colorScheme, washOpacity: isChild ? 0.2 : 0.35)
            )
            .background(colour.opacity(isChild ? 0.2 : 0.35), in: RoundedRectangle(cornerRadius: 11.5, style: .continuous))
            .overlay {
                if isSelected {
                    RoundedRectangle(cornerRadius: 11.5, style: .continuous)
                        .strokeBorder(colour, style: StrokeStyle(lineWidth: 2))
                }
            }
            .opacity(isDimmed ? 0.5 : 1)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

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
