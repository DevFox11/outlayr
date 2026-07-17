//
//  SuggestedCategoriesView.swift
//  Outlayr
//

import Combine
import CoreHaptics
import Popovers
import SwiftUI
import UIKit

struct SuggestedCategoriesView: View {
    let income: Bool
    @FetchRequest private var categories: FetchedResults<Category>

    @Environment(\.managedObjectContext) var moc
    @Environment(DataController.self) private var dataController

    var nameArray: [String] {
        var emptyArray = [String]()

        categories.forEach { category in
            emptyArray.append(category.wrappedName)
        }

        return emptyArray
    }

    var emojiArray: [String] {
        var emptyArray = [String]()

        categories.forEach { category in
            emptyArray.append(category.wrappedEmoji)
        }

        return emptyArray
    }

    var suggestions: [SuggestedCategory] {
        var holding = [SuggestedCategory]()

        if income {
            SuggestedCategory.incomes.forEach { category in
                if !nameArray.contains(category.name) && !emojiArray.contains(category.emoji) {
                    holding.append(category)
                }
            }
        } else {
            SuggestedCategory.expenses.forEach { category in
                if !nameArray.contains(category.name) && !emojiArray.contains(category.emoji) {
                    holding.append(category)
                }
            }
        }

        return holding
    }

    @State private var availableColours: [String] = Color.colorArray
    @State private var selectedColour = "1"

    var body: some View {
        if !suggestions.isEmpty {
            Section(header: Text("SUGGESTED").foregroundStyle(Color.SubtitleText)) {
                ForEach(suggestions, id: \.self) { category in
                    HStack(spacing: 8) {
                        Text(category.emoji)
//                            .font(.system(size: 15))
                            .font(.system(.subheadline, design: .rounded))
                            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                        Text(LocalizedStringKey(category.name))
                            .font(.system(.body, design: .rounded))
                            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                            .font(.system(size: 18.5, weight: .regular, design: .rounded))
                            .lineLimit(1)

                        Spacer()

                        Image(systemName: "plus")
                            .font(.system(.subheadline, design: .rounded).weight(.semibold))
                            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Color.SubtitleText)
                            .padding(4)
                            .background(Color.SecondaryBackground, in: Circle())
                            .contentShape(Circle())
                    }
                    .padding(.vertical, 5)
                    .foregroundStyle(Color.PrimaryText)
                    .listRowBackground(Color.SettingsBackground)
                    .listRowSeparatorTint(Color.Outline)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        // double check

                        let (outcome, _) = dataController.categoryCheck(name: category.name, emoji: category.emoji, income: income)

                        if outcome != .none {
                            return
                        }

                        let impactMed = UIImpactFeedbackGenerator(style: .light)
                        impactMed.impactOccurred()

                        if !income {
                            let suggestedCategory = Category(context: moc)
                            suggestedCategory.name = NSLocalizedString(category.name, comment: "category name")
                            suggestedCategory.emoji = category.emoji
                            suggestedCategory.dateCreated = Date.now
                            suggestedCategory.id = UUID()
                            suggestedCategory.colour = selectedColour
                            suggestedCategory.order = (categories.last?.order ?? 0) + 1
                            suggestedCategory.income = false
                            dataController.save()

                            availableColours = Color.colorArray
                            categories.forEach { category in
                                if availableColours.contains(category.wrappedColour) {
                                    availableColours.remove(at: availableColours.firstIndex(of: category.wrappedColour) ?? 0)
                                }
                            }

                            if availableColours.isEmpty {
                                selectedColour = "#FFFFFF"
                            } else {
                                selectedColour = availableColours[0]
                            }
                        } else {
                            let suggestedCategory = Category(context: moc)
                            suggestedCategory.name = NSLocalizedString(category.name, comment: "category name")
                            suggestedCategory.emoji = category.emoji
                            suggestedCategory.dateCreated = Date.now
                            suggestedCategory.id = UUID()
                            suggestedCategory.colour = "#76FBB0"
                            suggestedCategory.order = (categories.last?.order ?? 0) + 1
                            suggestedCategory.income = true
                            dataController.save()
                        }
                    }
                }
            }
            .onAppear {
                if !income {
                    categories.forEach { category in
                        if availableColours.contains(category.wrappedColour) {
                            availableColours.remove(at: availableColours.firstIndex(of: category.wrappedColour) ?? 0)
                        }
                    }

                    if availableColours.isEmpty {
                        selectedColour = "#FFFFFF"
                    } else {
                        selectedColour = availableColours[0]
                    }
                }
            }
        }
    }

    init(income: Bool) {
        _categories = FetchRequest<Category>(sortDescriptors: [
            SortDescriptor(\.order)
        ], predicate: NSPredicate(format: "income = %d", income))

        self.income = income
    }
}
