//
//  CategoryStepperView.swift
//  Outlayr
//

import Foundation
import SwiftUI

struct CategoryStepperView: View {
    @Binding var categoryFilter: Category?
    @Environment(DataController.self) private var dataController
    @State var income = false
    @State var categories = [Category]()
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        HStack(spacing: 8) {
            if income {
                Button {
                    let fetchRequest = dataController.categories.fetchRequestForTopLevelCategories(income: false)
                    let holding = dataController.results(for: fetchRequest)
                    if holding.isEmpty { return }
                    income = false
                    categories = holding
                    categoryFilter = categories[0]
                } label: {
                    Image(systemName: "plus")
                        .font(.system(.body, design: .rounded).weight(.semibold))
                        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                        .foregroundStyle(Color.IncomeGreen)
                        .padding(7)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .aspectRatio(1.0, contentMode: .fit)
                        .background(Color.IncomeGreen.opacity(0.23), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(String(localized: "accessibility.showExpenseCategories"))
            } else {
                Button {
                    let fetchRequest = dataController.categories.fetchRequestForTopLevelCategories(income: true)
                    let holding = dataController.results(for: fetchRequest)
                    if holding.isEmpty { return }
                    income = true
                    categories = holding
                    categoryFilter = categories[0]
                } label: {
                    Image(systemName: "minus")
                        .font(.system(.body, design: .rounded).weight(.semibold))
                        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                        .foregroundStyle(Color.AlertRed)
                        .padding(7)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .aspectRatio(1.0, contentMode: .fit)
                        .background(Color.AlertRed.opacity(0.23), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(String(localized: "accessibility.showIncomeCategories"))
            }

            ScrollView(.horizontal, showsIndicators: false) {
                ScrollViewReader { value in
                    HStack(spacing: 8) {
                        ForEach(categories, id: \.self) { item in
                            Button {
                                categoryFilter = item
                                withAnimation {
                                    value.scrollTo(item.id, anchor: .leading)
                                }
                            } label: {
                                HStack(spacing: 5) {
                                    CategoryIconGlyph(symbol: item.displaySymbol, size: 14)
                                    Text(item.wrappedName)
                                        .font(.system(.body, design: .rounded).weight(.medium))
                                        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                                }
                                .id(item.id)
                                .padding(.horizontal, 11)
                                .padding(.vertical, 7)
                                .fixedSize(horizontal: false, vertical: true)
                                .foregroundStyle(categoryFilter == item ? CategoryTileShading.glyph(for: Color(hex: item.wrappedColor), in: colorScheme, washOpacity: 0.3) : Color.PrimaryText)
                                .background(getBackground(category: item), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                                .overlay {
                                    if categoryFilter != item {
                                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                                            .strokeBorder(Color.Outline,
                                                          style: StrokeStyle(lineWidth: 1.5))
                                    }
                                }
                                .contentShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(item.wrappedName)
                            .accessibilityAddTraits(categoryFilter == item ? .isSelected : [])
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 30)
        .onAppear {
            let fetchRequest = dataController.categories.fetchRequestForTopLevelCategories(income: income)
            categories = dataController.results(for: fetchRequest)

            if categories.isEmpty {
                categoryFilter = nil
            } else {
                categoryFilter = categories[0]
            }
        }
        .onChange(of: income) { _, _ in
            if categories.isEmpty {
                categoryFilter = nil
            } else {
                categoryFilter = categories[0]
            }
        }
    }

    func getBackground(category: Category) -> Color {
        if category == categoryFilter {
            return Color(hex: category.wrappedColor).opacity(0.3)
        } else {
            return Color.PrimaryBackground
        }
    }

    init(categoryFilter: Binding<Category?>?) {
        _categoryFilter = categoryFilter ?? Binding.constant(nil)
    }
}
