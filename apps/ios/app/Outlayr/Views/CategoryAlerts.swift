//
//  CategoryAlerts.swift
//  Outlayr
//

import CoreData
import HugeiconsCore
import HugeiconsSolidRounded
import HugeiconsStrokeRounded
import SwiftUI
import UIKit

private enum CategoryField: Hashable {
    case name
}

private extension CategoryError {
    var alertMessage: LocalizedStringKey? {
        switch self {
        case .none: return nil
        case .incomplete: return "Please choose an icon or emoji, and a name."
        case .missingIcon: return "Please choose an icon or emoji for the category."
        case .missingName: return "Please enter a name for this category."
        case .duplicate: return "A category with this symbol and name already exists."
        case .duplicateIcon: return "Another category already uses this icon."
        case .duplicateEmoji: return "Another category already uses this emoji."
        case .duplicateName: return "Another category already uses this name."
        }
    }
}

// MARK: - Create

struct NewCategoryAlert: View {
    @Binding var income: Bool
    let budgetMode: Bool
    let parent: Category?

    init(income: Binding<Bool>, budgetMode: Bool = false, parent: Category? = nil) {
        _income = income
        self.budgetMode = budgetMode
        self.parent = parent
    }

    @Environment(\.dismiss) private var dismiss
    @Environment(\.managedObjectContext) private var moc
    @Environment(DataController.self) private var dataController

    @FetchRequest(sortDescriptors: [SortDescriptor(\.order)], predicate: NSPredicate(format: "income = %d", false))
    private var expenseCategories: FetchedResults<Category>

    @State private var name = ""
    @State private var symbol = CategorySymbolSelection()
    @State private var selectedColour = "#FFFFFF"
    @State private var errorMessage: LocalizedStringKey?
    @State private var justAdded = false
    @State private var flashTask: Task<Void, Never>?
    @State private var choosingIcon = false
    @State private var detent: PresentationDetent = .medium
    @FocusState private var focusedField: CategoryField?

    private static let maxExpenseCategories = 24

    private var atExpenseLimit: Bool { expenseCategories.count >= Self.maxExpenseCategories }
    private var isSubcategory: Bool { parent != nil }
    private var typePickerHidden: Bool { budgetMode || atExpenseLimit || isSubcategory }

    private var isValid: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !symbol.isEmpty
    }

    private var usedColours: Set<String> {
        Set(expenseCategories.map(\.wrappedColour))
    }

    private var colourCaption: Text? {
        if let parent {
            return Text("Inherits \(parent.wrappedName)'s colour.")
        }
        if income {
            return Text("Income categories use the income colour.")
        }
        return nil
    }

    /// Examples beat labels: the placeholder teaches what belongs in the field
    /// and follows the selected type live.
    private var namePlaceholder: LocalizedStringKey {
        if isSubcategory { return "Coffee, Snacks…" }
        return income ? "Salary, Freelance…" : "Groceries, Rent…"
    }

    var body: some View {
        NavigationStack {
            CategorySheetSurface(
                symbol: $symbol,
                selectedColour: $selectedColour,
                choosingIcon: $choosingIcon,
                income: income,
                showsColourRow: !income && !isSubcategory,
                usedColours: usedColours,
                onHeroTap: openPicker
            ) {
                Form {
                    CategoryNameSection(
                        name: $name,
                        typeSelection: typePickerHidden ? nil : $income,
                        placeholder: namePlaceholder,
                        caption: colourCaption,
                        focusedField: $focusedField
                    ) {
                        add()
                    }
                }
                .safeAreaInset(edge: .bottom) {
                    Button {
                        add()
                    } label: {
                        Text(isSubcategory ? "Add Subcategory" : "Add Category")
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
            .navigationTitle(isSubcategory ? "New Subcategory" : "New Category")
            .navigationBarTitleDisplayMode(.inline)
            .presentationDetents([.medium, .large], selection: $detent)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        dismiss()
                    } label: {
                        ToolbarIcon("cancel-01")
                    }                    .accessibilityLabel("Cancel")
                }
            }
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
                if !isSubcategory, count >= Self.maxExpenseCategories, !income { dismiss() }
            }
            .onDisappear { flashTask?.cancel() }
            .overlay(alignment: .bottom) {
                if justAdded {
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.circle.fill")
                        Text("Category added")
                    }
                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.IncomeGreen)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(Capsule().fill(Color(.secondarySystemGroupedBackground)))
                    .overlay(Capsule().strokeBorder(Color.PrimaryText.opacity(0.12), lineWidth: 1))
                    .padding(.bottom, 20)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .animation(.spring(response: 0.35, dampingFraction: 0.8), value: justAdded)
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

    private func firstAvailableColour() -> String {
        let used = usedColours
        return Color.colorArray.first { !used.contains($0) } ?? "#FFFFFF"
    }

    private func add() {
        let result = dataController.categoryCheck(
            name: name,
            icon: symbol.icon,
            emoji: symbol.emoji,
            income: income
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

        let category = Category(context: moc)
        category.name = name.trimmingCharacters(in: .whitespaces).capitalized
        symbol.apply(to: category)
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
        symbol = CategorySymbolSelection()
        selectedColour = firstAvailableColour()
        flashAddedConfirmation()
    }

    private func flashAddedConfirmation() {
        // Back-to-back adds must not let the first timer clear the second flash.
        flashTask?.cancel()
        justAdded = true
        flashTask = Task {
            try? await Task.sleep(for: .seconds(2))
            guard !Task.isCancelled else { return }
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
        let result = dataController.categoryCheckEdit(
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

// MARK: - Form sections

private struct CategoryNameSection: View {
    @Binding var name: String
    var typeSelection: Binding<Bool>?
    let placeholder: LocalizedStringKey
    let caption: Text?
    var focusedField: FocusState<CategoryField?>.Binding
    let onSubmit: () -> Void

    var body: some View {
        Section {
            HStack {
                Text("Name")
                    .foregroundColor(.secondary)
                Spacer()
                TextField(placeholder, text: $name)
                    .multilineTextAlignment(.trailing)
                    .textInputAutocapitalization(.words)
                    .submitLabel(.done)
                    .focused(focusedField, equals: .name)
                    .onSubmit(onSubmit)
            }

            if let typeSelection {
                HStack {
                    Text("Type")
                        .foregroundColor(.secondary)
                    Spacer()
                    Picker("Type", selection: typeSelection) {
                        Text("Expense").tag(false)
                        Text("Income").tag(true)
                    }
                    .pickerStyle(.menu)
                    .labelsHidden()
                    .tint(.primary)
                }
            }
        } footer: {
            if let caption {
                caption
            }
        }
    }
}

// MARK: - Icon catalogue

/// The full category glyph catalogue, grouped by theme, with search.
struct CategoryIconBrowser: View {
    @Binding var selection: String
    let tint: Color
    var query: String = ""
    var headerBackground: Color = .clear

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 10), count: 6)

    private var results: [CategoryIcon] {
        CategoryIconCatalog.icons(matching: query)
    }

    private var isSearching: Bool {
        !query.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        Group {
            if isSearching {
                searchResults
            } else {
                groupedCatalog
            }
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 24)
    }

    private var groupedCatalog: some View {
        LazyVStack(alignment: .leading, spacing: 20, pinnedViews: .sectionHeaders) {
            ForEach(CategoryIconCatalog.groups) { group in
                Section {
                    grid(for: group.icons)
                } header: {
                    Text(LocalizedStringKey(group.title))
                        .font(.system(.subheadline, design: .rounded, weight: .semibold))
                        .foregroundStyle(Color.SubtitleText)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 8)
                        .background(headerBackground)
                }
            }
        }
    }

    @ViewBuilder
    private var searchResults: some View {
        if results.isEmpty {
            Text("No icons found")
                .font(.system(.subheadline, design: .rounded))
                .foregroundStyle(Color.SubtitleText)
                .frame(maxWidth: .infinity)
                .padding(.top, 60)
        } else {
            grid(for: results)
        }
    }

    private func grid(for icons: [CategoryIcon]) -> some View {
        LazyVGrid(columns: columns, spacing: 10) {
            ForEach(icons) { icon in
                SymbolIconCell(
                    icon: icon,
                    tint: tint,
                    isSelected: icon.name == selection
                ) {
                    selection = icon.name
                }
            }
        }
    }
}

// MARK: - Shared style

/// The shared press feedback for the category hero: a brief squeeze, no ripple.
struct GridPressStyle: ButtonStyle {
    var scale: CGFloat = 0.96
    var pressedOpacity: Double? = 0.85

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? scale : 1)
            .opacity(configuration.isPressed ? (pressedOpacity ?? 1) : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: configuration.isPressed)
    }
}
