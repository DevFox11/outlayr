//
//  CategoryView.swift
//  Outlayr
//
//  Created by Rafael Soh on 10/5/22.
//

import CoreData
import SwiftUI
import UIKit

/// A single top-level category rendered as a card: parent header, its subcategories,
/// and an "Add Subcategory" row. Children come from a scoped `@FetchRequest` so that
/// drag-reordering (which rewrites `order`) refreshes reliably. Child rows are
/// draggable, and the header is a drop target so a subcategory can be moved into
/// another parent.
struct ParentSection: View {
    @ObservedObject var parent: Category
    let income: Bool
    let onEditParent: () -> Void
    let onEditChild: (Category) -> Void
    let onDeleteParent: () -> Void
    let onDeleteChild: (Category) -> Void
    let onAddChild: () -> Void

    @Environment(\.managedObjectContext) private var moc
    @Environment(DataController.self) private var dataController

    @AppStorage(DefaultsKey.currency, store: AppIdentifiers.sharedDefaults)
    private var currency: String = Locale.current.currency?.identifier ?? "USD"

    @FetchRequest private var children: FetchedResults<Category>

    init(
        parent: Category,
        income: Bool,
        onEditParent: @escaping () -> Void,
        onEditChild: @escaping (Category) -> Void,
        onDeleteParent: @escaping () -> Void,
        onDeleteChild: @escaping (Category) -> Void,
        onAddChild: @escaping () -> Void
    ) {
        self.parent = parent
        self.income = income
        self.onEditParent = onEditParent
        self.onEditChild = onEditChild
        self.onDeleteParent = onDeleteParent
        self.onDeleteChild = onDeleteChild
        self.onAddChild = onAddChild
        _children = FetchRequest<Category>(
            sortDescriptors: [SortDescriptor(\.order)],
            predicate: NSPredicate(format: "parent == %@", parent)
        )
    }

    private var accent: Color {
        income ? Color.IncomeGreen : Color(hex: parent.wrappedColor)
    }

    var body: some View {
        Section {
            headerRow
                .contentShape(.rect)
                .onTapGesture { onEditParent() }
                .swipeActions(edge: .trailing) {
                    Button(role: .destructive) { onDeleteParent() } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
                .dropDestination(for: String.self) { items, _ in
                    reparent(items)
                }

            ForEach(children) { child in
                childRow(child)
                    .contentShape(.rect)
                    .onTapGesture { onEditChild(child) }
                    .draggable(child.objectID.uriRepresentation().absoluteString)
                    .swipeActions(edge: .trailing) {
                        Button(role: .destructive) { onDeleteChild(child) } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
            }

            addRow
        }
    }

    private var headerRow: some View {
        HStack(spacing: 12) {
            CategoryIconTile(symbol: parent.displaySymbol, tint: accent)

            Text(parent.wrappedName)
                .font(.system(.body, design: .rounded, weight: .semibold))
                .lineLimit(1)
                .foregroundStyle(Color.PrimaryText)

            Spacer()

            amountLabel(rolledUpTotal)

            Image(systemName: "chevron.right")
                .font(.system(.footnote, design: .rounded, weight: .semibold))
                .foregroundStyle(Color.SubtitleText)
        }
        .padding(.vertical, 4)
    }

    private func childRow(_ child: Category) -> some View {
        HStack(spacing: 10) {
            CategoryIconTile(symbol: child.displaySymbol, tint: accent, size: .small)

            Text(child.wrappedName)
                .font(.system(.subheadline, design: .rounded))
                .lineLimit(1)
                .foregroundStyle(Color.PrimaryText)

            Spacer()

            amountLabel(total(of: child.allTransactions))

            Image(systemName: "chevron.right")
                .font(.system(.caption, design: .rounded, weight: .semibold))
                .foregroundStyle(Color.SubtitleText)
        }
        .padding(.vertical, 3)
        .padding(.leading, 16)
    }

    private var addRow: some View {
        Button {
            onAddChild()
        } label: {
            Label("Add Subcategory", systemImage: "plus.circle.fill")
                .font(.system(.subheadline, design: .rounded, weight: .medium))
                .foregroundStyle(income ? Color.accentColor : accent)
        }
        .padding(.leading, 16)
    }

    @ViewBuilder
    private func amountLabel(_ amount: Double) -> some View {
        if amount > 0 {
            Text(amount, format: .currency(code: currency).precision(.fractionLength(0)))
                .font(.system(.subheadline, design: .rounded, weight: .medium))
                .foregroundStyle(Color.SubtitleText)
                .lineLimit(1)
        }
    }

    private var rolledUpTotal: Double {
        total(of: parent.allTransactionsIncludingChildren)
    }

    private func total(of transactions: [Transaction]) -> Double {
        transactions.reduce(0) { $0 + $1.wrappedAmount }
    }

    /// Moves dropped subcategories under this parent, appended after existing children.
    private func reparent(_ identifiers: [String]) -> Bool {
        guard let coordinator = moc.persistentStoreCoordinator else { return false }
        var next = (children.last?.order ?? -1) + 1
        var moved = false

        for identifier in identifiers {
            guard let url = URL(string: identifier),
                  let objectID = coordinator.managedObjectID(forURIRepresentation: url),
                  let child = try? moc.existingObject(with: objectID) as? Category,
                  child != parent,
                  child.parent != parent
            else { continue }

            child.parent = parent
            child.income = parent.income
            child.color = parent.wrappedColor
            child.order = next
            next += 1
            moved = true
        }

        if moved {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            try? dataController.save()
        }
        return moved
    }
}
