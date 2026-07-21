//
//  CategoryView.swift
//  Outlayr
//
//  Created by Rafael Soh on 10/5/22.
//

import CoreData
import SwiftUI

/// Dedicated sheet for reordering the top-level category cards. Classic `.onMove`
/// reorders rows within one collection but not whole List sections, so parent
/// reordering lives here as a flat, always-editing list.
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
                ForEach(parents) { parent in
                    HStack(spacing: 12) {
                        CategoryIconTile(
                            symbol: parent.displaySymbol,
                            tint: income ? Color.IncomeGreen : Color(hex: parent.wrappedColour)
                        )
                        Text(parent.wrappedName)
                            .font(.system(.body, design: .rounded, weight: .medium))
                            .foregroundStyle(Color.PrimaryText)
                        Spacer()
                    }
                    // Re-flip row content to LTR; the enclosing List is RTL only to
                    // move the system reorder grip to the leading (left) edge.
                    .environment(\.layoutDirection, .leftToRight)
                }
                .onMove(perform: move)
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

    private func move(at source: IndexSet, to destination: Int) {
        var items = Array(parents)
        items.move(fromOffsets: source, toOffset: destination)
        for (index, item) in items.enumerated() {
            item.order = Int64(index)
        }
        dataController.save()
    }
}
