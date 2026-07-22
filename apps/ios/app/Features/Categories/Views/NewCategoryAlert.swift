//
//  CategoryAlerts.swift
//  Outlayr
//

import CoreData
import SwiftUI
import UIKit

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
    @State private var selectedColor = "#FFFFFF"
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

    private var usedColors: Set<String> {
        Set(expenseCategories.map(\.wrappedColor))
    }

    private var colorCaption: Text? {
        if let parent {
            return Text("Inherits \(parent.wrappedName)'s color.")
        }
        if income {
            return Text("Income categories use the income color.")
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
                selectedColor: $selectedColor,
                choosingIcon: $choosingIcon,
                income: income,
                showsColorRow: !income && !isSubcategory,
                usedColors: usedColors,
                onHeroTap: openPicker
            ) {
                Form {
                    CategoryNameSection(
                        name: $name,
                        typeSelection: typePickerHidden ? nil : $income,
                        placeholder: namePlaceholder,
                        caption: colorCaption,
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
                    }                    .accessibilityLabel(String(localized: "accessibility.cancel"))
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
                    selectedColor = parent.wrappedColor
                } else {
                    if atExpenseLimit { income = true }
                    selectedColor = firstAvailableColor()
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
                    .scaledFont(14, weight: .semibold, design: .rounded)
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

    private func firstAvailableColor() -> String {
        let used = usedColors
        return Color.colorArray.first { !used.contains($0) } ?? "#FFFFFF"
    }

    private func add() {
        let result = dataController.categories.categoryCheck(
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
            category.color = income ? "IncomeGreen" : parent.wrappedColor
        } else {
            category.order = result.order
            category.color = income ? "IncomeGreen" : selectedColor
        }
        try? dataController.save()

        UINotificationFeedbackGenerator().notificationOccurred(.success)

        if budgetMode || parent != nil {
            dismiss()
            return
        }

        name = ""
        symbol = CategorySymbolSelection()
        selectedColor = firstAvailableColor()
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
