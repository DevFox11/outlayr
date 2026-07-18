//
//  CategoryView.swift
//  Outlayr
//
//  Created by Rafael Soh on 10/5/22.
//

import CoreData
import SwiftUI
import UIKit

enum CategoryViewMode {
    case welcome, settings, transaction
}

struct CategoryView: View {
    var mode: CategoryViewMode
    @State var income = false

    var body: some View {
        switch mode {
        case .settings:
            CategoryListView(mode: mode, income: $income)
        case .welcome, .transaction:
            NavigationStack {
                CategoryListView(mode: mode, income: $income)
            }
        }
    }
}

struct CategoryListView: View {
    let mode: CategoryViewMode
    @Binding var income: Bool

    @Environment(\.dismiss) private var dismiss
    @Environment(\.managedObjectContext) private var moc
    @Environment(DataController.self) private var dataController

    @AppStorage("categorySuggestions", store: AppIdentifiers.sharedDefaults)
    private var showSuggestions = true

    @FetchRequest private var categories: FetchedResults<Category>

    @FetchRequest(sortDescriptors: [SortDescriptor(\.order)])
    private var allCategories: FetchedResults<Category>

    @State private var newCategory = false
    @State private var toEdit: Category?
    @State private var toDelete: Category?
    @State private var addChildTo: Category?
    @State private var reordering = false

    init(mode: CategoryViewMode, income: Binding<Bool>) {
        self.mode = mode
        _income = income
        _categories = FetchRequest<Category>(
            sortDescriptors: [SortDescriptor(\.order)],
            predicate: NSPredicate(format: "income = %d AND parent == nil", income.wrappedValue)
        )
    }

    var body: some View {
        List {
            if categories.isEmpty {
                Section { emptyState }
            } else {
                ForEach(categories) { parent in
                    ParentSection(
                        parent: parent,
                        income: income,
                        onEditParent: { toEdit = parent },
                        onEditChild: { toEdit = $0 },
                        onDeleteParent: { toDelete = parent },
                        onDeleteChild: { toDelete = $0 },
                        onAddChild: { addChildTo = parent }
                    )
                }
            }

            if showSuggestions {
                SuggestedCategoriesView(income: income)
            }
        }
        .listStyle(.insetGrouped)
        .contentMargins(.top, 8, for: .scrollContent)
        .modifier(SoftBottomScrollEdge())
        .navigationTitle("Categories")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { toolbarContent }
        .onChange(of: income) { UISelectionFeedbackGenerator().selectionChanged() }
        .safeAreaInset(edge: .bottom) {
            if mode == .welcome {
                continueButton
            }
        }
        .sheet(isPresented: $newCategory) {
            NewCategoryAlert(income: $income, bottomSpacers: false)
        }
        .sheet(item: $toEdit) { category in
            EditCategoryAlert(toEdit: category)
        }
        .sheet(item: $addChildTo) { parent in
            NewCategoryAlert(income: $income, bottomSpacers: false, parent: parent)
        }
        .sheet(isPresented: $reordering) {
            ReorderCategoriesSheet(income: income)
        }
        .alert(
            "Delete '\(toDelete?.wrappedName ?? "")'?",
            isPresented: deleteBinding,
            presenting: toDelete
        ) { category in
            Button("Delete", role: .destructive) { delete(category) }
            Button("Cancel", role: .cancel) {}
        } message: { category in
            Text(deleteMessage(for: category))
        }
    }

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        if mode == .transaction {
            ToolbarItem(placement: .topBarLeading) {
                Button("Done") { dismiss() }
            }
        }

        ToolbarItemGroup(placement: .topBarTrailing) {
            Button {
                withAnimation { showSuggestions.toggle() }
            } label: {
                ToolbarIcon(showSuggestions ? .viewOffSlash : .view)
            }
            .accessibilityLabel(showSuggestions ? "Hide Suggestions" : "Show Suggestions")

            if categories.count > 1 {
                Button {
                    reordering = true
                } label: {
                    ToolbarIcon(.arrowUpDown)
                }
                .accessibilityLabel("Reorder Categories")
            }
        }

        if #available(iOS 26, *) {
            // The picker draws its own background, so the toolbar must not wrap it
            // in a second glass capsule.
            ToolbarItem(placement: .bottomBar) {
                typePicker
                    .frame(width: 190)
            }
            .sharedBackgroundVisibility(.hidden)

            ToolbarSpacer(.flexible, placement: .bottomBar)

            ToolbarItem(placement: .bottomBar) {
                newCategoryButton
            }
        } else {
            ToolbarItemGroup(placement: .bottomBar) {
                typePicker
                    .frame(width: 190)

                Spacer()

                newCategoryButton
            }
        }
    }

    private var newCategoryButton: some View {
        Button {
            newCategory = true
        } label: {
            ToolbarIcon(.plusSign)
        }
        .accessibilityLabel("New Category")
    }

    private var basePicker: some View {
        Picker("Category Type", selection: $income) {
            Text("Expense").tag(false)
            Text("Income").tag(true)
        }
    }

    @ViewBuilder
    private var typePicker: some View {
        if #available(iOS 27.0, *) {
            basePicker.pickerStyle(.tabs)
        } else {
            basePicker.pickerStyle(.segmented)
        }
    }

    private var continueButton: some View {
        Button {
            dismiss()
        } label: {
            Text("Continue")
                .font(.system(.body, design: .rounded, weight: .semibold))
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .controlSize(.large)
        .disabled(allCategories.isEmpty)
        .padding()
        .background(.bar)
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "tray")
                .font(.system(.largeTitle, design: .rounded, weight: .light))
                .foregroundStyle(Color.SubtitleText)

            Text(income ? "no_income_categories" : "no_expense_categories")
                .font(.system(.body, design: .rounded, weight: .medium))
                .italic()
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.SubtitleText)
        }
        .frame(maxWidth: .infinity, alignment: .center)
        .padding(.vertical, 37)
    }

    private var deleteBinding: Binding<Bool> {
        Binding(get: { toDelete != nil }, set: { if !$0 { toDelete = nil } })
    }

    private func deleteMessage(for category: Category) -> LocalizedStringKey {
        if category.hasChildren {
            return "This can't be undone. \(category.wrappedName) transactions will be deleted; its subcategories will be moved to the top level."
        }
        return "This can't be undone. All \(category.wrappedName) transactions will be deleted too."
    }

    private func delete(_ category: Category) {
        UINotificationFeedbackGenerator().notificationOccurred(.warning)
        withAnimation {
            moc.delete(category)
            dataController.save()
        }
    }
}

/// Hiding a toolbar item's shared background makes the bar fall back to a hard-edged
/// scroll effect, which reads as an opaque band clipping the content. Soft restores
/// the transparent bar.
private struct SoftBottomScrollEdge: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26, *) {
            content.scrollEdgeEffectStyle(.soft, for: .bottom)
        } else {
            content
        }
    }
}

/// A single top-level category rendered as a card: parent header, its subcategories,
/// and an "Add Subcategory" row. Children come from a scoped `@FetchRequest` so that
/// drag-reordering (which rewrites `order`) refreshes reliably. Child rows are
/// draggable, and the header is a drop target so a subcategory can be moved into
/// another parent.
private struct ParentSection: View {
    @ObservedObject var parent: Category
    let income: Bool
    let onEditParent: () -> Void
    let onEditChild: (Category) -> Void
    let onDeleteParent: () -> Void
    let onDeleteChild: (Category) -> Void
    let onAddChild: () -> Void

    @Environment(\.managedObjectContext) private var moc
    @Environment(DataController.self) private var dataController

    @AppStorage("currency", store: AppIdentifiers.sharedDefaults)
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
        income ? Color.IncomeGreen : Color(hex: parent.wrappedColour)
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
            Text(parent.wrappedEmoji)
                .font(.system(.title3, design: .rounded))

            Text(parent.wrappedName)
                .font(.system(.body, design: .rounded, weight: .semibold))
                .lineLimit(1)
                .foregroundStyle(Color.PrimaryText)

            Spacer()

            amountLabel(rolledUpTotal)

            if !income {
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(accent)
                    .frame(width: 22, height: 22)
            }

            Image(systemName: "chevron.right")
                .font(.system(.footnote, design: .rounded, weight: .semibold))
                .foregroundStyle(Color.SubtitleText)
        }
        .padding(.vertical, 4)
    }

    private func childRow(_ child: Category) -> some View {
        HStack(spacing: 10) {
            Text(child.wrappedEmoji)
                .font(.system(.subheadline, design: .rounded))

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
            child.colour = parent.wrappedColour
            child.order = next
            next += 1
            moved = true
        }

        if moved {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            dataController.save()
        }
        return moved
    }
}

/// Dedicated sheet for reordering the top-level category cards. Classic `.onMove`
/// reorders rows within one collection but not whole List sections, so parent
/// reordering lives here as a flat, always-editing list.
private struct ReorderCategoriesSheet: View {
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
                        Text(parent.wrappedEmoji)
                            .font(.system(.body, design: .rounded))
                        Text(parent.wrappedName)
                            .font(.system(.body, design: .rounded, weight: .medium))
                            .foregroundStyle(Color.PrimaryText)
                        Spacer()
                        if !income {
                            RoundedRectangle(cornerRadius: 5, style: .continuous)
                                .fill(Color(hex: parent.wrappedColour))
                                .frame(width: 18, height: 18)
                        }
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
