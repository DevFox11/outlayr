//
//  CategoryAlerts.swift
//  Outlayr
//

import CoreData
import SwiftUI
import UIKit

private enum CategoryField: Hashable {
    case name
}

private extension CategoryError {
    var alertMessage: LocalizedStringKey? {
        switch self {
        case .none: return nil
        case .incomplete: return "Please choose both an icon and a name."
        case .missingIcon: return "Please choose an icon for the category."
        case .missingName: return "Please enter a name for this category."
        case .duplicate: return "A category with this icon and name already exists."
        case .duplicateIcon: return "Another category already uses this icon."
        case .duplicateName: return "Another category already uses this name."
        }
    }
}

// MARK: - Create

struct NewCategoryAlert: View {
    @Binding var income: Bool
    let budgetMode: Bool
    let bottomSpacers: Bool
    let parent: Category?

    init(income: Binding<Bool>, bottomSpacers: Bool, budgetMode: Bool = false, parent: Category? = nil) {
        _income = income
        self.bottomSpacers = bottomSpacers
        self.budgetMode = budgetMode
        self.parent = parent
    }

    @Environment(\.dismiss) private var dismiss
    @Environment(\.managedObjectContext) private var moc
    @Environment(DataController.self) private var dataController

    @FetchRequest(sortDescriptors: [SortDescriptor(\.order)], predicate: NSPredicate(format: "income = %d", false))
    private var expenseCategories: FetchedResults<Category>

    @State private var name = ""
    @State private var iconName = ""
    @State private var selectedColour = "#FFFFFF"
    @State private var errorMessage: LocalizedStringKey?
    @State private var justAdded = false
    @FocusState private var focusedField: CategoryField?

    private var atExpenseLimit: Bool { expenseCategories.count >= 24 }
    private var isSubcategory: Bool { parent != nil }
    private var typePickerHidden: Bool { budgetMode || atExpenseLimit || isSubcategory }

    private var isValid: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !iconName.isEmpty
    }

    private var usedColours: Set<String> {
        Set(expenseCategories.map(\.wrappedColour))
    }

    var body: some View {
        NavigationStack {
            Form {
                if !typePickerHidden {
                    Section {
                        Picker("Type", selection: $income) {
                            Text("Expense").tag(false)
                            Text("Income").tag(true)
                        }
                        .pickerStyle(.segmented)
                    }
                }

                CategoryFieldsSection(iconName: $iconName, name: $name, income: income, colour: selectedColour, focusedField: $focusedField) {
                    add()
                }

                if !income && !isSubcategory {
                    Section("COLOUR") {
                        ColourPickerView(selectedColour: $selectedColour, usedColours: usedColours)
                    }
                }

                if justAdded {
                    Section {
                        Label("Category added", systemImage: "checkmark.circle.fill")
                            .font(.system(.subheadline, design: .rounded, weight: .medium))
                            .foregroundStyle(Color.IncomeGreen)
                    }
                }
            }
            .navigationTitle(isSubcategory ? "New Subcategory" : "New Category")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") { add() }
                        .disabled(!isValid)
                }
            }
            .presentationDetents([.medium, .large])
            .alert("Couldn't Add Category", isPresented: errorBinding, presenting: errorMessage) { _ in
                Button("OK", role: .cancel) {}
            } message: { message in
                Text(message)
            }
            .onAppear {
                if let parent {
                    income = parent.income
                    selectedColour = parent.wrappedColour
                } else {
                    if atExpenseLimit { income = true }
                    selectedColour = firstAvailableColour()
                }
            }
            .onChange(of: expenseCategories.count) { _, count in
                if !isSubcategory, count >= 24, !income { dismiss() }
            }
        }
    }

    private var errorBinding: Binding<Bool> {
        Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })
    }

    private func firstAvailableColour() -> String {
        let used = usedColours
        return Color.colorArray.first { !used.contains($0) } ?? "#FFFFFF"
    }

    private func add() {
        let result = dataController.categoryCheck(name: name, icon: iconName, income: income)

        guard result.error == .none else {
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            errorMessage = result.error.alertMessage
            switch result.error {
            case .missingName, .duplicateName: focusedField = .name
            default: break
            }
            return
        }

        let category = Category(context: moc)
        category.name = name.trimmingCharacters(in: .whitespaces).capitalized
        category.icon = iconName
        category.dateCreated = .now
        category.id = UUID()
        category.income = income
        category.parent = parent
        if let parent {
            category.order = (parent.sortedChildren.last?.order ?? -1) + 1
            category.colour = income ? "IncomeGreen" : parent.wrappedColour
        } else {
            category.order = result.order
            category.colour = income ? "IncomeGreen" : selectedColour
        }
        dataController.save()

        UINotificationFeedbackGenerator().notificationOccurred(.success)

        if budgetMode || parent != nil {
            dismiss()
            return
        }

        name = ""
        iconName = ""
        selectedColour = firstAvailableColour()
        flashAddedConfirmation()
    }

    private func flashAddedConfirmation() {
        justAdded = true
        Task {
            try? await Task.sleep(for: .seconds(2))
            justAdded = false
        }
    }
}

// MARK: - Edit

struct EditCategoryAlert: View {
    let toEdit: Category

    @Environment(\.dismiss) private var dismiss
    @Environment(DataController.self) private var dataController

    @FetchRequest(sortDescriptors: [SortDescriptor(\.order)], predicate: NSPredicate(format: "income = %d", false))
    private var expenseCategories: FetchedResults<Category>

    @State private var name = ""
    @State private var iconName = ""
    @State private var selectedColour = "#FFFFFF"
    @State private var errorMessage: LocalizedStringKey?
    @State private var confirmingDelete = false
    @FocusState private var focusedField: CategoryField?

    /// A category migrated from the emoji era has no stored icon; requiring one
    /// here would block every unrelated edit until the user picked a glyph.
    private var isValid: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && (!iconName.isEmpty || toEdit.icon == nil)
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
            Form {
                CategoryFieldsSection(iconName: $iconName, name: $name, income: toEdit.income, colour: selectedColour, focusedField: $focusedField) {
                    save()
                }

                if !toEdit.income && !toEdit.isSubcategory {
                    Section("COLOUR") {
                        ColourPickerView(selectedColour: $selectedColour, usedColours: usedColours)
                    }
                }

                Section {
                    Button(toEdit.isSubcategory ? "Delete Subcategory" : "Delete Category", role: .destructive) {
                        confirmingDelete = true
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .navigationTitle(editTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(!isValid)
                }
            }
            .presentationDetents([.medium, .large])
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
                iconName = toEdit.icon ?? ""
                selectedColour = toEdit.wrappedColour
            }
        }
    }

    private var errorBinding: Binding<Bool> {
        Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })
    }

    private func save() {
        let result = dataController.categoryCheckEdit(name: name, icon: iconName, toEdit: toEdit)

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
        toEdit.icon = iconName.isEmpty ? nil : iconName
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

// MARK: - Shared fields

private struct CategoryFieldsSection: View {
    @Binding var iconName: String
    @Binding var name: String
    let income: Bool
    let colour: String
    var focusedField: FocusState<CategoryField?>.Binding
    let onSubmit: () -> Void

    @State private var choosingIcon = false

    private var tint: Color {
        income ? Color.IncomeGreen : Color(hex: colour)
    }

    private var previewIcon: CategoryIcon {
        CategoryIconCatalog.icon(named: iconName) ?? CategoryIconCatalog.fallback(income: income)
    }

    /// Until an icon is picked the tile stays neutral, so the colour swatch below
    /// remains the only colour affordance.
    private var previewTint: Color {
        iconName.isEmpty ? Color.SubtitleText : tint
    }

    var body: some View {
        Section {
            Button {
                choosingIcon = true
            } label: {
                CategoryIconTile(
                    icon: previewIcon,
                    tint: previewTint,
                    size: .large
                )
            }
            .buttonStyle(.plain)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .listRowBackground(Color.clear)
            .accessibilityLabel("Category icon")

            TextField("Category Name", text: $name)
                .font(.system(.body, design: .rounded))
                .textInputAutocapitalization(.words)
                .submitLabel(.done)
                .focused(focusedField, equals: .name)
                .onSubmit(onSubmit)
        }
        .sheet(isPresented: $choosingIcon) {
            IconPickerView(selection: $iconName, tint: tint)
        }
    }
}
