//
//  CategoryView.swift
//  Outlayr
//
//  Created by Rafael Soh on 10/5/22.
//

import CoreData
import SwiftUI

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

    init(mode: CategoryViewMode, income: Binding<Bool>) {
        self.mode = mode
        _income = income
        _categories = FetchRequest<Category>(
            sortDescriptors: [SortDescriptor(\.order)],
            predicate: NSPredicate(format: "income = %d", income.wrappedValue)
        )
    }

    private var sectionHeader: LocalizedStringKey {
        income ? "INCOME CATEGORIES" : "EXPENSE CATEGORIES"
    }

    var body: some View {
        List {
            Section(header: Text(sectionHeader).foregroundStyle(Color.SubtitleText)) {
                if categories.isEmpty {
                    emptyState
                } else {
                    ForEach(categories) { category in
                        CategoryRow(
                            emoji: category.wrappedEmoji,
                            name: category.wrappedName,
                            colourHex: category.wrappedColour,
                            showsColour: !income
                        )
                        .contentShape(.rect)
                        .onTapGesture { toEdit = category }
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) {
                                toDelete = category
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                        .swipeActions(edge: .leading) {
                            Button {
                                toEdit = category
                            } label: {
                                Label("Edit", systemImage: "pencil")
                            }
                            .tint(Color("Yellow"))
                        }
                    }
                    .onMove(perform: moveItem)
                }
            }

            if showSuggestions {
                SuggestedCategoriesView(income: income)
            }
        }
        .safeAreaInset(edge: .top) { typePicker }
        .navigationTitle("Categories")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { toolbarContent }
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
        .alert(
            "Delete '\(toDelete?.wrappedName ?? "")'?",
            isPresented: deleteBinding,
            presenting: toDelete
        ) { category in
            Button("Delete", role: .destructive) { delete(category) }
            Button("Cancel", role: .cancel) {}
        } message: { category in
            Text("This can't be undone. All \(category.wrappedName) transactions will be deleted too.")
        }
    }

    private var typePicker: some View {
        Picker("Type", selection: $income) {
            Text("Expense").tag(false)
            Text("Income").tag(true)
        }
        .pickerStyle(.segmented)
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(.bar)
    }

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        if mode == .transaction {
            ToolbarItem(placement: .topBarLeading) {
                Button("Done") { dismiss() }
            }
        }

        ToolbarItemGroup(placement: .topBarTrailing) {
            if categories.count > 1 {
                EditButton()
            }

            Button {
                withAnimation { showSuggestions.toggle() }
            } label: {
                Label(
                    showSuggestions ? "Hide Suggestions" : "Show Suggestions",
                    systemImage: showSuggestions ? "eye.slash" : "eye"
                )
            }

            Button {
                newCategory = true
            } label: {
                Label("New Category", systemImage: "plus")
            }
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

    private func delete(_ category: Category) {
        UINotificationFeedbackGenerator().notificationOccurred(.warning)
        withAnimation {
            moc.delete(category)
            dataController.save()
        }
    }

    private func moveItem(at sets: IndexSet, destination: Int) {
        guard let itemToMove = sets.first else { return }

        if itemToMove < destination {
            var startIndex = itemToMove + 1
            let endIndex = destination - 1
            var startOrder = categories[itemToMove].order
            while startIndex <= endIndex {
                categories[startIndex].order = startOrder
                startOrder += 1
                startIndex += 1
            }
            categories[itemToMove].order = startOrder
        } else if destination < itemToMove {
            var startIndex = destination
            let endIndex = itemToMove - 1
            var startOrder = categories[destination].order + 1
            let newOrder = categories[destination].order
            while startIndex <= endIndex {
                categories[startIndex].order = startOrder
                startOrder += 1
                startIndex += 1
            }
            categories[itemToMove].order = newOrder
        }

        dataController.save()
    }
}

private struct CategoryRow: View {
    let emoji: String
    let name: String
    let colourHex: String
    let showsColour: Bool

    var body: some View {
        HStack(spacing: 10) {
            Text(emoji)
                .font(.system(.subheadline, design: .rounded))
            Text(name)
                .font(.system(.body, design: .rounded))
                .lineLimit(1)
                .foregroundStyle(Color.PrimaryText)

            Spacer()

            if showsColour {
                RoundedRectangle(cornerRadius: 5, style: .continuous)
                    .fill(Color(hex: colourHex))
                    .frame(width: 20, height: 20)
            }
        }
        .padding(.vertical, 5)
    }
}
