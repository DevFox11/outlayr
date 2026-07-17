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
    @FetchRequest private var categories: FetchedResults<Category>

    private let layout = [
        GridItem(.flexible(), spacing: 10),
        GridItem(.flexible())
    ]

    init(
        category: Binding<Category?>?, showPicker: Binding<Bool>, showSheet: Binding<Bool>,
        income: Bool
    ) {
        _categories = FetchRequest<Category>(
            sortDescriptors: [SortDescriptor(\.order, order: .reverse)],
            predicate: NSPredicate(format: "income = %d", income)
        )
        _category = category ?? Binding.constant(nil)
        _showPicker = showPicker
        _showingCategoryView = showSheet
    }

    var body: some View {
        ScrollView {
            LazyVGrid(columns: layout, spacing: 10) {
                ForEach(categories) { item in
                    CategoryChip(
                        emoji: item.wrappedEmoji,
                        name: item.wrappedName,
                        colourHex: item.wrappedColour,
                        isSelected: item == category,
                        isDimmed: category != nil && category != item
                    ) {
                        select(item)
                    }
                }
            }
        }
        .scrollIndicators(.hidden)
        .keyboardAwareHeight(showToolbar: false)
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .overlay(alignment: .bottom) { editButton }
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
    let emoji: String
    let name: String
    let colourHex: String
    let isSelected: Bool
    let isDimmed: Bool
    let action: () -> Void

    private var colour: Color { Color(hex: colourHex) }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 7) {
                Text(emoji)
                    .font(.system(.subheadline, design: .rounded))
                Text(name)
                    .font(.system(.body, design: .rounded, weight: .semibold))
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 11)
            .padding(.vertical, 9)
            .foregroundStyle(colour)
            .background(colour.opacity(0.35), in: RoundedRectangle(cornerRadius: 11.5, style: .continuous))
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
