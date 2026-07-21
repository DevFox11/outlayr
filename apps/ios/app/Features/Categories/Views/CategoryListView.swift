//
//  CategoryView.swift
//  Outlayr
//
//  Created by Rafael Soh on 10/5/22.
//

import CoreData
import SwiftUI
import UIKit

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
            NewCategoryAlert(income: $income)
        }
        .sheet(item: $toEdit) { category in
            EditCategoryAlert(toEdit: category)
        }
        .sheet(item: $addChildTo) { parent in
            NewCategoryAlert(income: $income, parent: parent)
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
                ToolbarIcon(showSuggestions ? "view-off-slash" : "view")
            }
            .accessibilityLabel(showSuggestions ? "Hide Suggestions" : "Show Suggestions")

            if categories.count > 1 {
                Button {
                    reordering = true
                } label: {
                    ToolbarIcon("arrow-up-down")
                }
                .accessibilityLabel("Reorder Categories")
            }
        }

        if #available(iOS 26, *) {
            // The picker draws its own background, so the toolbar must not wrap it
            // in a second glass capsule.
            ToolbarItem(placement: .bottomBar) {
                CategoryTypePicker(income: $income)
                    .frame(width: 190)
            }
            .sharedBackgroundVisibility(.hidden)

            ToolbarSpacer(.flexible, placement: .bottomBar)

            ToolbarItem(placement: .bottomBar) {
                newCategoryButton
            }
        } else {
            ToolbarItemGroup(placement: .bottomBar) {
                CategoryTypePicker(income: $income)
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
            ToolbarIcon("plus-sign")
        }
        .accessibilityLabel("New Category")
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
