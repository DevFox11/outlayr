//
//  CategoryAlerts.swift
//  Outlayr
//

import CoreData
import SwiftUI
import UIKit

struct EditCategoryAlert: View {
    let toEdit: Category

    @Environment(\.dismiss) private var dismiss
    @Environment(DataController.self) private var dataController

    @FetchRequest(sortDescriptors: [SortDescriptor(\.order)], predicate: NSPredicate(format: "income = %d", false))
    private var expenseCategories: FetchedResults<Category>

    @State private var name = ""
    @State private var symbol = CategorySymbolSelection()
    @State private var selectedColour = "#FFFFFF"
    @State private var errorMessage: LocalizedStringKey?
    @State private var confirmingDelete = false
    @State private var choosingIcon = false
    @State private var detent: PresentationDetent = .medium
    @FocusState private var focusedField: CategoryField?

    /// A category migrated from the emoji era has no stored icon; requiring one
    /// here would block every unrelated edit until the user picked a glyph.
    private var isValid: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && (!symbol.isEmpty || (toEdit.icon == nil && toEdit.wrappedEmoji == nil))
    }

    private var editTitle: LocalizedStringKey {
        if toEdit.isSubcategory { return "Subcategory" }
        return toEdit.income ? "Income Category" : "Expense Category"
    }

    private var deleteMessage: LocalizedStringKey {
        if toEdit.hasChildren {
            return "This can't be undone. \(toEdit.wrappedName) transactions will be deleted; its subcategories will be moved to the top level."
        }
        return "This can't be undone. All \(toEdit.wrappedName) transactions will be deleted too."
    }

    private var usedColours: Set<String> {
        Set(expenseCategories.filter { $0 != toEdit }.map(\.wrappedColour))
    }

    var body: some View {
        NavigationStack {
            CategorySheetSurface(
                symbol: $symbol,
                selectedColour: $selectedColour,
                choosingIcon: $choosingIcon,
                income: toEdit.income,
                showsColourRow: !toEdit.income && !toEdit.isSubcategory,
                usedColours: usedColours,
                onHeroTap: openPicker
            ) {
                Form {
                    CategoryNameSection(
                        name: $name,
                        placeholder: toEdit.isSubcategory
                            ? "Coffee, Snacks…"
                            : (toEdit.income ? "Salary, Freelance…" : "Groceries, Rent…"),
                        caption: nil,
                        focusedField: $focusedField
                    ) {
                        save()
                    }

                }
                .safeAreaInset(edge: .bottom) {
                    Button {
                        save()
                    } label: {
                        Text(toEdit.isSubcategory ? "Save Subcategory" : "Save Category")
                            .font(.system(.body, design: .rounded, weight: .semibold))
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .tint(Color.PrimaryText)
                    .disabled(!isValid)
                    .padding(.horizontal, 20)
                    .padding(.bottom, 8)
                }
            }
            .navigationTitle(editTitle)
            .navigationBarTitleDisplayMode(.inline)
            .presentationDetents([.medium, .large], selection: $detent)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        dismiss()
                    } label: {
                        ToolbarIcon("cancel-01")
                    }                    .accessibilityLabel("Cancel")
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        confirmingDelete = true
                    } label: {
                        ToolbarIcon("delete-02", color: Color.AlertRed)
                    }                    .accessibilityLabel(toEdit.isSubcategory ? "Delete Subcategory" : "Delete Category")
                }
            }
            .alert("Couldn't Save Category", isPresented: errorBinding, presenting: errorMessage) { _ in
                Button("OK", role: .cancel) {}
            } message: { message in
                Text(message)
            }
            .alert("Delete '\(toEdit.wrappedName)'?", isPresented: $confirmingDelete) {
                Button("Delete", role: .destructive) { delete() }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text(deleteMessage)
            }
            .onAppear {
                name = toEdit.wrappedName
                // The raw stored value, not `wrappedIcon`: seeding the resolved
                // fallback would let an unrecognised icon from a newer version be
                // silently overwritten with the fallback name on save.
                symbol = CategorySymbolSelection(category: toEdit)
                selectedColour = toEdit.wrappedColour
            }
        }
    }

    private func openPicker() {
        // The nested picker is 430pt tall; from the medium detent it would cover the
        // whole parent, so the parent grows first and stays there afterwards.
        focusedField = nil
        withAnimation(IdentityHero.motion) {
            detent = .large
            choosingIcon = true
        }
    }

    private var errorBinding: Binding<Bool> {
        Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })
    }

    private func save() {
        let result = dataController.categories.categoryCheckEdit(
            name: name,
            icon: symbol.icon,
            emoji: symbol.emoji,
            toEdit: toEdit
        )

        guard result.error == .none else {
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            errorMessage = result.error.alertMessage
            switch result.error {
            case .missingName, .duplicateName: focusedField = .name
            default: break
            }
            return
        }

        toEdit.name = name.trimmingCharacters(in: .whitespaces).capitalized
        symbol.apply(to: toEdit)
        if !toEdit.income {
            toEdit.colour = selectedColour
        }
        dataController.save()

        UINotificationFeedbackGenerator().notificationOccurred(.success)
        dismiss()
    }

    private func delete() {
        UINotificationFeedbackGenerator().notificationOccurred(.warning)
        dataController.container.viewContext.delete(toEdit)
        dataController.save()
        dismiss()
    }
}
