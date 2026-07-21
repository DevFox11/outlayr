//
//  CategoryRowPickerView.swift
//  Outlayr
//
//  Created by Rafael Soh on 4/9/23.
//

import Foundation
import CoreData
import Popovers
import SwiftUI
import WidgetKit

struct CategoryRowPickerView: View {
    @FetchRequest(sortDescriptors: [SortDescriptor(\.order)], predicate: NSPredicate(format: "income = %d", false)) private var expenseCategories: FetchedResults<Category>
    @FetchRequest(sortDescriptors: [SortDescriptor(\.order)], predicate: NSPredicate(format: "income = %d", true)) private var incomeCategories: FetchedResults<Category>

    @Binding var selectedCategory: Category?
    @State var showCategorySheet = false
    let income: Bool

    var empty: Bool {
        if income {
            return incomeCategories.isEmpty
        } else {
            return expenseCategories.isEmpty
        }
    }

    var body: some View {
        HStack(spacing: 8) {
            if empty {
                Text("No categories found")
                    .font(.system(size: 17.5, weight: .medium, design: .rounded))
                    .padding(.horizontal, 13)
                    .foregroundStyle(Color.SubtitleText)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .frame(height: 36)
                    .overlay(
                        RoundedRectangle(cornerRadius: 11.5, style: .continuous)
                            .stroke(Color.Outline, lineWidth: 1.5)
                    )

            } else {
                GeometryReader { gp in
                    ZStack {
                        ScrollView(.horizontal, showsIndicators: false) {
                            ScrollViewReader { value in
                                HStack(spacing: 8) {
                                    ForEach(income ? incomeCategories : expenseCategories, id: \.self) { item in
                                        HStack(spacing: 5) {
                                            CategoryIconGlyph(symbol: item.displaySymbol, size: 14)
                                            Text(item.wrappedName)
                                                .font(.system(size: 17.5, weight: .medium, design: .rounded))
                                        }
                                        .id(item.id)
                                        .padding(.horizontal, 10)
                                        .frame(height: 36)
                                        .foregroundStyle(selectedCategory == item ? (item.income ? Color.IncomeGreen : Color(hex: item.wrappedColour)) : Color.PrimaryText)
                                        .background(getBackground(category: item), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                                        .overlay {
                                            if selectedCategory != item {
                                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                                    .strokeBorder(Color.Outline,
                                                                  style: StrokeStyle(lineWidth: 1.5))
                                            }
                                        }
                                        .onTapGesture {
                                            selectedCategory = item
                                            withAnimation {
                                                value.scrollTo(item.id, anchor: .leading)
                                            }
                                        }
                                    }
                                }
                                .onChange(of: income) { _, newValue in
                                    if newValue {
                                        if let firstCategory = incomeCategories.first {
                                            value.scrollTo(firstCategory.id, anchor: .leading)
                                        }
                                    } else {
                                        if let firstCategory = expenseCategories.first {
                                            value.scrollTo(firstCategory.id, anchor: .leading)
                                        }
                                    }
                                }
                                .onAppear {
                                    if let unwrappedCategory = selectedCategory {
                                        withAnimation {
                                            value.scrollTo(unwrappedCategory.id, anchor: .leading)
                                        }
                                    }
                                }
                            }
                        }
                        .clipped()

                        // inject gradient at right side only
                        Rectangle()
                            .fill(
                                LinearGradient(gradient: Gradient(stops: [
                                    .init(color: Color.PrimaryBackground.opacity(0.01), location: 0),
                                    .init(color: Color.PrimaryBackground, location: 1)
                                ]), startPoint: .leading, endPoint: .trailing)
                            ).frame(width: 0.1 * gp.size.width)
                            .frame(maxWidth: .infinity, alignment: .trailing)

                            .allowsHitTesting(false) // << now works !!

                    }.fixedSize(horizontal: false, vertical: true)
                }
                .frame(height: 36)
                .frame(maxWidth: .infinity)
            }

            Group {
                if empty {
                    Image(systemName: "plus")
                        .font(.system(size: 16, weight: .semibold, design: .rounded))
                        .foregroundStyle(Color.SubtitleText)
                } else {
                    Image(systemName: "pencil")
                        .font(.system(size: 16, weight: .semibold, design: .rounded))
                        .foregroundStyle(Color.SubtitleText)
                }

//                        Text("Edit")
//                            .font(.system(size: 17.5, weight: .semibold, design: .rounded))
//                            .lineLimit(1)
            }
            .padding(.horizontal, 9)
            .frame(height: 36)
            .background(Color.SecondaryBackground, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
//                    .overlay(
//                        RoundedRectangle(cornerRadius: 11.5, style: .continuous)
//                            .stroke(Color.Outline, lineWidth: 1.5)
//                    )
            .onTapGesture {
                showCategorySheet = true
            }
        }
        .frame(maxWidth: .infinity)
        .sheet(isPresented: $showCategorySheet) {
            CategoryView(mode: .transaction, income: income)
        }
    }

    func getBackground(category: Category) -> Color {
        if category.income {
            if category == selectedCategory {
                return Color.IncomeGreen.opacity(0.3)
            } else {
                return Color.PrimaryBackground
            }
        } else {
            if category == selectedCategory {
                return Color(hex: category.wrappedColour).opacity(0.3)
            } else {
                return Color.PrimaryBackground
            }
        }
    }

    init(category: Binding<Category?>?, income: Bool) {
        _selectedCategory = category ?? Binding.constant(nil)
//        self.categories = categories
//        let dataController = DataController.shared
//        let fetchRequest = dataController.fetchRequestForCategories(income: income)
//        self.categories = dataController.results(for: fetchRequest)
        self.income = income
    }
}
