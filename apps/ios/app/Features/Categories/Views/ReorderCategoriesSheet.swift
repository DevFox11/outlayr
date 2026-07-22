//
//  CategoryView.swift
//  Outlayr
//
//  Created by Rafael Soh on 10/5/22.
//

import CoreData
import SwiftUI

/// Dedicated sheet for reordering the top-level category cards and their subcategories.
/// Parents are reordered as a flat list; each parent section shows its children so they
/// can be reordered within their group. Cross-group moves are structurally impossible
/// because `.onMove` is scoped to one section at a time.
struct ReorderCategoriesSheet: View {
    let income: Bool

    @Environment(\.dismiss) private var dismiss
    @Environment(DataController.self) private var dataController
    @FetchRequest private var parents: FetchedResults<Category>

    init(income: Bool) {
        self.income = income
        _parents = FetchRequest<Category>(
            sortDescriptors: [SortDescriptor(\.order)],
            predicate: NSPredicate(format: "income = %d AND parent == nil", income)
        )
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(parents) { parent in
                        parentRow(parent)
                            .environment(\.layoutDirection, .leftToRight)
                    }
                    .onMove(perform: moveParents)
                } header: {
                    Text("Categories")
                        .font(.system(.footnote, design: .rounded, weight: .semibold))
                        .foregroundStyle(Color.SubtitleText)
                        .environment(\.layoutDirection, .leftToRight)
                }

                ForEach(parents) { parent in
                    if parent.hasChildren {
                        ChildrenSection(parent: parent, income: income, dataController: dataController)
                    }
                }
            }
            .contentMargins(.top, 8, for: .scrollContent)
            .environment(\.layoutDirection, .rightToLeft)
            .environment(\.editMode, .constant(.active))
            .navigationTitle("Reorder Categories")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .presentationDetents([.medium, .large])
        }
    }

    private func parentRow(_ parent: Category) -> some View {
        HStack(spacing: 12) {
            CategoryIconTile(
                symbol: parent.displaySymbol,
                tint: income ? Color.IncomeGreen : Color(hex: parent.wrappedColor)
            )
            Text(parent.wrappedName)
                .font(.system(.body, design: .rounded, weight: .medium))
                .foregroundStyle(Color.PrimaryText)
            Spacer()
        }
    }

    private func moveParents(at source: IndexSet, to destination: Int) {
        var items = Array(parents)
        items.move(fromOffsets: source, toOffset: destination)
        for (index, item) in items.enumerated() {
            item.order = Int64(index)
        }
        try? dataController.save()
    }
}

/// A List section showing a parent's children so they can be reordered within the group.
/// Lives in its own view so the scoped `@FetchRequest` refreshes when `order` changes.
private struct ChildrenSection: View {
    @ObservedObject var parent: Category
    let income: Bool
    let dataController: DataController

    @FetchRequest private var children: FetchedResults<Category>

    init(parent: Category, income: Bool, dataController: DataController) {
        self.parent = parent
        self.income = income
        self.dataController = dataController
        _children = FetchRequest<Category>(
            sortDescriptors: [SortDescriptor(\.order)],
            predicate: NSPredicate(format: "parent == %@", parent)
        )
    }

    var body: some View {
        Section {
            ForEach(children) { child in
                HStack(spacing: 12) {
                    CategoryIconTile(
                        symbol: child.displaySymbol,
                        tint: income ? Color.IncomeGreen : Color(hex: parent.wrappedColor),
                        size: .small
                    )
                    Text(child.wrappedName)
                        .font(.system(.subheadline, design: .rounded))
                        .foregroundStyle(Color.PrimaryText)
                    Spacer()
                }
                .environment(\.layoutDirection, .leftToRight)
            }
            .onMove(perform: moveChildren)
        } header: {
            Text(parent.wrappedName)
                .font(.system(.footnote, design: .rounded, weight: .semibold))
                .foregroundStyle(Color.SubtitleText)
                .environment(\.layoutDirection, .leftToRight)
        }
    }

    private func moveChildren(at source: IndexSet, to destination: Int) {
        var items = Array(children)
        items.move(fromOffsets: source, toOffset: destination)
        for (index, item) in items.enumerated() {
            item.order = Int64(index)
        }
        try? dataController.save()
    }
}
