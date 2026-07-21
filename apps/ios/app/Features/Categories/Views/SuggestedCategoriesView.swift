//
//  SuggestedCategoriesView.swift
//  Outlayr
//

import CoreData
import SwiftUI

struct SuggestedCategoriesView: View {
    let income: Bool

    @FetchRequest private var categories: FetchedResults<Category>
    @Environment(\.managedObjectContext) private var moc
    @Environment(DataController.self) private var dataController

    init(income: Bool) {
        self.income = income
        _categories = FetchRequest<Category>(
            sortDescriptors: [SortDescriptor(\.order)],
            predicate: NSPredicate(format: "income = %d", income)
        )
    }

    private var suggestions: [SuggestedCategory] {
        let usedNames = Set(categories.map(\.wrappedName))
        let usedIcons = Set(categories.compactMap(\.icon))
        let pool = income ? SuggestedCategory.incomes : SuggestedCategory.expenses
        return pool.filter { !usedNames.contains($0.name) && !usedIcons.contains($0.icon) }
    }

    var body: some View {
        if !suggestions.isEmpty {
            Section("SUGGESTED") {
                ForEach(suggestions, id: \.self) { suggestion in
                    SuggestedCategoryRow(suggestion: suggestion, income: income) {
                        add(suggestion)
                    }
                }
            }
        }
    }

    private func add(_ suggestion: SuggestedCategory) {
        guard dataController.categoryCheck(name: suggestion.name, icon: suggestion.icon, emoji: "", income: income).error == .none else {
            return
        }

        UIImpactFeedbackGenerator(style: .light).impactOccurred()

        let category = Category(context: moc)
        category.name = NSLocalizedString(suggestion.name, comment: "category name")
        category.icon = suggestion.icon
        category.dateCreated = .now
        category.id = UUID()
        category.income = income
        category.order = (categories.last?.order ?? 0) + 1
        category.colour = suggestion.colour

        dataController.save()
    }
}

private struct SuggestedCategoryRow: View {
    let suggestion: SuggestedCategory
    let income: Bool
    let add: () -> Void

    private var icon: CategoryIcon {
        CategoryIconCatalog.icon(named: suggestion.icon) ?? CategoryIconCatalog.fallback(income: income)
    }

    var body: some View {
        Button(action: add) {
            HStack(spacing: 10) {
                CategoryIconTile(icon: icon, colour: suggestion.colour)

                Text(LocalizedStringKey(suggestion.name))
                    .font(.system(.body, design: .rounded))
                    .lineLimit(1)
                    .foregroundStyle(Color.PrimaryText)

                Spacer()

                Image(systemName: "plus.circle.fill")
                    .font(.system(.title3, design: .rounded))
                    .foregroundStyle(Color.SubtitleText)
                    .symbolRenderingMode(.hierarchical)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text("Add \(suggestion.name)"))
    }
}
