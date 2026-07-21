//
//  NewCategoryPickerView.swift
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
