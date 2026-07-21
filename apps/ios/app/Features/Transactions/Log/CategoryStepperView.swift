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

    var body: some View {
        HStack(spacing: 8) {
            if income {
                Image(systemName: "plus")
                    .font(.system(.body, design: .rounded).weight(.semibold))
                    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(Color.IncomeGreen)
                    .padding(7)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .aspectRatio(1.0, contentMode: .fit)
//                    .frame(width: 36, height: 36)
                    .background(Color.IncomeGreen.opacity(0.23), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .contentShape(Rectangle())
                    .onTapGesture {
                        let fetchRequest = dataController.categories.fetchRequestForCategories(income: false)
                        let holding = dataController.results(for: fetchRequest)

                        if holding.isEmpty {
                            return
                        } else {
                            income = false
                            categories = holding
                            categoryFilter = categories[0]
                        }
                    }
            } else {
                Image(systemName: "minus")
                    .font(.system(.body, design: .rounded).weight(.semibold))
                    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(Color.AlertRed)
                    .padding(7)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .aspectRatio(1.0, contentMode: .fit)
//                    .frame(width: 36, height: 36)
                    .background(Color.AlertRed.opacity(0.23), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .contentShape(Rectangle())
                    .onTapGesture {
                        let fetchRequest = dataController.categories.fetchRequestForCategories(income: true)
                        let holding = dataController.results(for: fetchRequest)

                        if holding.isEmpty {
                            return
                        } else {
                            income = true
                            categories = holding
                            categoryFilter = categories[0]
                        }
                    }
            }

            ScrollView(.horizontal, showsIndicators: false) {
                ScrollViewReader { value in
                    HStack(spacing: 8) {
                        ForEach(categories, id: \.self) { item in
                            HStack(spacing: 5) {
                                CategoryIconGlyph(symbol: item.displaySymbol, size: 14)
                                Text(item.wrappedName)
//                                    .font(.system(size: 17.5, weight: .medium, design: .rounded))
                                    .font(.system(.body, design: .rounded).weight(.medium))
                                    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                            }
                            .id(item.id)
                            .padding(.horizontal, 11)
                            .padding(.vertical, 7)
                            .fixedSize(horizontal: false, vertical: true)
//                            .frame(height: 36)
                            .foregroundStyle(categoryFilter == item ? Color(hex: item.wrappedColour) : Color.PrimaryText)
                            .background(getBackground(category: item), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                            .overlay {
                                if categoryFilter != item {
                                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                                        .strokeBorder(Color.Outline,
                                                      style: StrokeStyle(lineWidth: 1.5))
                                }
                            }
                            .onTapGesture {
                                categoryFilter = item
                                withAnimation {
                                    value.scrollTo(item.id, anchor: .leading)
                                }
                            }
//                            .accessibilityElement(children: .ignore)
//                            .accessibilityLabel("filter \(item.wrappedName) transactions button")
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 30)
        .onAppear {
            let fetchRequest = dataController.categories.fetchRequestForCategories(income: income)
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
            return Color(hex: category.wrappedColour).opacity(0.3)
        } else {
            return Color.PrimaryBackground
        }
    }

    init(categoryFilter: Binding<Category?>?) {
        _categoryFilter = categoryFilter ?? Binding.constant(nil)
    }
}
