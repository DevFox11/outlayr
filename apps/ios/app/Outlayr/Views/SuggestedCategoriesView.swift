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
        let usedEmoji = Set(categories.map(\.wrappedEmoji))
        let pool = income ? SuggestedCategory.incomes : SuggestedCategory.expenses
        return pool.filter { !usedNames.contains($0.name) && !usedEmoji.contains($0.emoji) }
    }

    var body: some View {
        if !suggestions.isEmpty {
            Section("SUGGESTED") {
                ForEach(suggestions, id: \.self) { suggestion in
                    SuggestedCategoryRow(name: suggestion.name, emoji: suggestion.emoji) {
                        add(suggestion)
                    }
                }
            }
        }
    }

    private func add(_ suggestion: SuggestedCategory) {
        guard dataController.categoryCheck(name: suggestion.name, emoji: suggestion.emoji, income: income).error == .none else {
            return
        }

        UIImpactFeedbackGenerator(style: .light).impactOccurred()

        let category = Category(context: moc)
        category.name = NSLocalizedString(suggestion.name, comment: "category name")
        category.emoji = suggestion.emoji
        category.dateCreated = .now
        category.id = UUID()
        category.income = income
        category.order = (categories.last?.order ?? 0) + 1
        category.colour = suggestion.colour

        dataController.save()
    }
}

private struct SuggestedCategoryRow: View {
    let name: String
    let emoji: String
    let add: () -> Void

    var body: some View {
        Button(action: add) {
            HStack(spacing: 10) {
                Text(emoji)
                    .font(.system(.subheadline, design: .rounded))
                Text(LocalizedStringKey(name))
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
        .accessibilityLabel(Text("Add \(name)"))
    }
}
