//
//  CategoryView.swift
//  xpenz
//
//  Created by Rafael Soh on 10/5/22.
//

import Combine
import CoreHaptics
import Popovers
import SwiftUI
import UIKit

enum CategoryViewMode {
    case welcome, settings, transaction
}

struct CategoryView: View {
    var mode: CategoryViewMode
//    @Environment(\.colorScheme) var colorScheme
    @State var income = false
    @Namespace var animation

    @State var newCategory = false

    @FetchRequest(sortDescriptors: [SortDescriptor(\.order)], predicate: NSPredicate(format: "income = %d", false)) private var expenseCategories: FetchedResults<Category>

    @State var showToast = false
    @State var toastTitle = ""
    @State var toastImage = ""
    @State var positive = false

    var disabled: Bool {
        income == false && expenseCategories.count >= 24
    }

    var body: some View {
        VStack(spacing: 5) {
            CategoryListView(income: $income, mode: mode, showToast: $showToast, toastTitle: $toastTitle, toastImage: $toastImage, positive: $positive)

            HStack {
                HStack(spacing: 0) {
                    Text("Expense")
                        .font(.system(.body, design: .rounded).weight(.semibold))
                        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                        .font(.system(size: 18, weight: .semibold, design: .rounded))
                        .foregroundStyle(income == false ? Color.PrimaryText : Color.SubtitleText)
                        .padding(6)
                        .padding(.horizontal, 8)
                        .background {
                            if income == false {
                                Capsule()
                                    .fill(Color.SecondaryBackground)
                                    .matchedGeometryEffect(id: "TAB1", in: animation)
                            }
                        }
                        .contentShape(Rectangle())
                        .onTapGesture {
                            DispatchQueue.main.async {
                                withAnimation(.easeIn(duration: 0.15)) {
                                    income = false
                                }
                            }
                        }

                    Text("Income")
                        .font(.system(.body, design: .rounded).weight(.semibold))
                        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                        .font(.system(size: 18, weight: .semibold, design: .rounded))
                        .foregroundStyle(income == true ? Color.PrimaryText : Color.SubtitleText)
                        .padding(6)
                        .padding(.horizontal, 8)
                        .background {
                            if income == true {
                                Capsule()
                                    .fill(Color.SecondaryBackground)
                                    .matchedGeometryEffect(id: "TAB1", in: animation)
                            }
                        }
                        .contentShape(Rectangle())
                        .onTapGesture {
                            DispatchQueue.main.async {
                                withAnimation(.easeIn(duration: 0.15)) {
                                    income = true
                                }
                            }
                        }
                }
                .padding(3)
                .layoutPriority(1)
                .overlay(Capsule().stroke(Color.Outline.opacity(0.4), lineWidth: 1.3))

                Spacer()

                HStack(spacing: 3) {
                    Image(systemName: "plus")
                        .font(.system(.subheadline, design: .rounded).weight(.semibold))
                        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                        .font(.system(size: 14.5, weight: .semibold, design: .rounded))

                    Text("New")
                        .font(.system(.body, design: .rounded).weight(.semibold))
                        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                        .font(.system(size: 18, weight: .semibold, design: .rounded))
                        .lineLimit(1)
                }
                .foregroundStyle(Color.PrimaryText)
                .padding(6)
                .padding(.horizontal, 4.5)
                .background(Color.SecondaryBackground, in: Capsule())
                .opacity(disabled ? 0.5 : 1)
                .contentShape(Rectangle())
                .onTapGesture {
                    if disabled {
                        showToast = true
                        toastImage = "exclamationmark.triangle.fill"
                        toastTitle = "Limit Exceeded"
                        positive = false
                    } else {
                        newCategory = true
                    }
                }
            }
            .padding(25)
        }
        .sheet(isPresented: $newCategory) {
            if #available(iOS 16.0, *) {
                NewCategoryAlert(income: $income, bottomSpacers: false)
                    .presentationDetents([.height(270)])
            } else {
                NewCategoryAlert(income: $income, bottomSpacers: true)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .ignoresSafeArea(.keyboard, edges: .all)
        .background(Color.PrimaryBackground)
    }
}

struct CategoryListView: View {
    @Binding var income: Bool
    var mode: CategoryViewMode

    @Environment(\.presentationMode) var presentationMode: Binding<PresentationMode>
    @Environment(\.dismiss) var dismiss
    @Environment(\.managedObjectContext) var moc
    @Environment(\.colorScheme) var systemColorScheme
    @Environment(DataController.self) private var dataController

    @AppStorage("bottomEdge", store: AppIdentifiers.sharedDefaults) var bottomEdge: Double = 15

    @AppStorage("categorySuggestions", store: AppIdentifiers.sharedDefaults) var showSuggestions: Bool = true
    @State var suggestionsToast = false

    @State private var offset: CGFloat = 0

    @FetchRequest private var categories: FetchedResults<Category>

    @State var isEditing = false

    @FetchRequest(sortDescriptors: [SortDescriptor(\.order)]) private var allCategories: FetchedResults<Category>

    // delete mode
    @State private var deleteMode = false
    @State private var toDelete: Category?
    var alertMessage: String {
        "Delete '" + (toDelete?.wrappedName ?? "") + "'?"
    }

    // edit mode
    @State private var toEdit: Category?

    // toasts
    @Binding var showToast: Bool
    @Binding var toastTitle: String
    @Binding var toastImage: String
    @Binding var positive: Bool

    var toastColor: Color {
        positive ? Color.IncomeGreen : Color.AlertRed
    }

    var sectionHeader: LocalizedStringKey {
        if income {
            return "INCOME CATEGORIES"
        } else {
            return "EXPENSE CATEGORIES"
        }
    }

    @Environment(\.dynamicTypeSize) var dynamicTypeSize

    var body: some View {
        VStack(spacing: 5) {
            if showToast {
                HStack(spacing: 6.5) {
                    Image(systemName: toastImage)
                        .font(.system(.subheadline, design: .rounded).weight(.semibold))
                        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(toastColor)

                    Text(toastTitle)
                        .font(.system(.body, design: .rounded).weight(.semibold))
                        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                        .lineLimit(1)
//                        .font(.system(size: 16, weight: .semibold, design: .rounded))
                        .foregroundStyle(toastColor)
                }
                .padding(8)
                .background(toastColor.opacity(0.23), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                .transition(AnyTransition.opacity.combined(with: .move(edge: .top)))
                .frame(maxWidth: 250)
                .frame(height: 35)
                .padding(20)
            } else {
                if mode == .welcome {
                    HStack(spacing: 8) {
                        if categories.count > 1 {
                            if isEditing {
                                Circle()
                                    .fill(Color.IncomeGreen.opacity(0.23))
                                    .frame(width: 33, height: 33)
                                    .overlay {
                                        Image(systemName: "checkmark")
                                            .font(.system(.callout, design: .rounded).weight(.semibold))
                                            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                                            .font(.system(size: 16, weight: .semibold))
                                            .foregroundStyle(Color.IncomeGreen)
                                    }
                                    .onTapGesture {
                                        withAnimation {
                                            isEditing.toggle()
                                        }
                                    }
                            } else {
                                Circle()
                                    .fill(Color.SecondaryBackground)
                                    .frame(width: 33, height: 33)
                                    .overlay {
                                        Image(systemName: "arrow.up.arrow.down")
                                            .font(.system(.callout, design: .rounded).weight(.semibold))
                                            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                                            .foregroundStyle(Color.SubtitleText)
                                    }
                                    .onTapGesture {
                                        withAnimation {
                                            isEditing.toggle()
                                        }
                                    }
                            }
                        }

                        Circle()
                            .fill(Color.SecondaryBackground)
                            .frame(width: 33, height: 33)
                            .overlay {
                                Image(systemName: showSuggestions ? "eye.slash" : "eye")
                                    .font(.system(.callout, design: .rounded).weight(.semibold))
                                    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                                    .foregroundStyle(Color.SubtitleText)
                                    .offset(y: 0.8)
                            }
                            .onTapGesture {
                                withAnimation {
                                    showSuggestions.toggle()
                                }
                            }

                        Spacer()

                        Circle()
                            .fill(!allCategories.isEmpty ? Color.IncomeGreen.opacity(0.23) : Color.clear)
                            .frame(width: 33, height: 33)
                            .overlay {
                                ZStack {
                                    Image(systemName: "arrow.right")
                                        .font(.system(.callout, design: .rounded).weight(.semibold))
                                        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                                        .foregroundStyle(!allCategories.isEmpty ? Color.IncomeGreen : Color.Outline.opacity(0.8))

                                    if allCategories.count == 0 {
                                        Circle()
                                            .stroke(Color.Outline.opacity(0.4), lineWidth: 1.3)
                                            .frame(width: 33, height: 33)
                                    }
                                }
                            }
                            .onTapGesture {
                                if allCategories.count > 0 {
                                    dismiss()
                                }
                            }
                    }
                    .frame(height: 35)
                    .frame(maxWidth: .infinity)
                    .overlay {
                        Text("Categories")
                            .font(.system(.title3, design: .rounded).weight(.medium))
                            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                            .font(.system(size: 20, weight: .medium, design: .rounded))
                    }
                    .padding(20)

                } else {
                    HStack(spacing: 8) {
                        if mode == .settings {
                            Circle()
                                .fill(Color.SecondaryBackground)
                                .frame(width: 33, height: 33)
                                .overlay {
                                    Image(systemName: "chevron.left")
                                        .font(.system(.body, design: .rounded).weight(.semibold))
                                        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                                        .font(.system(size: 18, weight: .semibold))
                                        .foregroundStyle(Color.SubtitleText)
                                        .offset(y: 0.8)
                                }
                                .onTapGesture {
                                    self.presentationMode.wrappedValue.dismiss()
                                }
                        } else {
                            Circle()
                                .fill(Color.SecondaryBackground)
                                .frame(width: 33, height: 33)
                                .overlay {
                                    Image(systemName: "chevron.down")
                                        .font(.system(.body, design: .rounded).weight(.semibold))
                                        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                                        .foregroundStyle(Color.SubtitleText)
                                        .offset(y: 0.8)
                                }
                                .onTapGesture {
                                    dismiss()
                                }
                        }

                        Spacer()

                        Circle()
                            .fill(Color.SecondaryBackground)
                            .frame(width: 33, height: 33)
                            .overlay {
                                Image(systemName: showSuggestions ? "eye.slash" : "eye")
                                    .font(.system(.callout, design: .rounded).weight(.semibold))
                                    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundStyle(Color.SubtitleText)
                                    .offset(y: 0.8)
                            }
                            .onTapGesture {
                                withAnimation {
                                    showSuggestions.toggle()
                                }
                            }

                        if categories.count > 1 {
                            if isEditing {
                                Circle()
                                    .fill(Color.IncomeGreen.opacity(0.23))
                                    .frame(width: 33, height: 33)
                                    .overlay {
                                        Image(systemName: "checkmark")
                                            .font(.system(.callout, design: .rounded).weight(.semibold))
                                            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                                            .font(.system(size: 16, weight: .semibold))
                                            .foregroundStyle(Color.IncomeGreen)
                                    }
                                    .onTapGesture {
                                        withAnimation {
                                            isEditing.toggle()
                                        }
                                    }
                            } else {
                                Circle()
                                    .fill(Color.SecondaryBackground)
                                    .frame(width: 33, height: 33)
                                    .overlay {
                                        Image(systemName: "arrow.up.arrow.down")
                                            .font(.system(.callout, design: .rounded).weight(.semibold))
                                            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                                            .font(.system(size: 16, weight: .semibold))
                                            .foregroundStyle(Color.SubtitleText)
                                    }
                                    .onTapGesture {
                                        withAnimation {
                                            isEditing.toggle()
                                        }
                                    }
                            }
                        }
                    }
                    .frame(height: 35)
                    .frame(maxWidth: .infinity)
                    .overlay {
                        Text("Categories")
                            .font(.system(.title3, design: .rounded).weight(mode == .settings ? .semibold : .medium))
                            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                            .font(.system(size: 20, weight: mode == .settings ? .semibold : .medium, design: .rounded))
                    }
                    .padding(20)
                }
            }

            VStack {
                if #available(iOS 16.0, *) {
                    List {
                        Section(header: Text(sectionHeader).foregroundStyle(Color.SubtitleText)) {
                            if categories.isEmpty {
                                VStack(spacing: 10) {
                                    Image(systemName: "tray")
                                        .font(.system(.largeTitle, design: .rounded).weight(.light))
                                        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                                        .font(.system(size: 37, weight: .light))
                                        .foregroundStyle(Color.SubtitleText)

                                    Group {
                                        if income {
                                            Text("no_income_categories")
                                        } else {
                                            Text("no_expense_categories")
                                        }
                                    }
                                    .font(.system(.body, design: .rounded).weight(.medium))
                                    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                                    .font(.system(size: 17, weight: .medium, design: .rounded))
                                    .italic()
                                    .multilineTextAlignment(.center)
                                    .foregroundStyle(Color.SubtitleText)
                                }
                                .frame(maxWidth: .infinity, alignment: .center)
                                .padding(.vertical, 37)
                                .listRowBackground(Color.SettingsBackground)
                            } else {
                                ForEach(categories) { category in
                                    HStack(spacing: 10) {
                                        Text(category.wrappedEmoji)
                                            .font(.system(.subheadline, design: .rounded))
                                            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                                            .font(.system(size: 15))
                                        Text(category.wrappedName)
                                            .font(.system(.body, design: .rounded))
                                            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                                            .font(.system(size: 18.5, weight: .regular, design: .rounded))
                                            .lineLimit(1)
                                            .foregroundStyle(toDelete == category ? Color.AlertRed : Color.PrimaryText)

                                        Spacer()

                                        if !income {
                                            RoundedRectangle(cornerRadius: 5, style: .continuous)
                                                .fill(Color(hex: category.wrappedColour))
                                                .frame(width: 20, height: 20)
                                        }
                                    }
                                    .padding(.vertical, 5)
                                    .listRowBackground(Color.SettingsBackground)
                                    .listRowSeparatorTint(Color.Outline)
                                    .contentShape(Rectangle())
                                    .onTapGesture {
                                        toEdit = category
                                    }
                                    .swipeActions(edge: .trailing) {
                                        Button {
                                            toDelete = category
                                        } label: {
                                            Image(systemName: "trash.fill")
                                        }
                                        .tint(Color.AlertRed)
                                    }
                                    .swipeActions(edge: .leading) {
                                        Button {
                                            toEdit = category
                                        } label: {
                                            Image(systemName: "pencil")
                                        }
                                        .tint(Color("Yellow"))
                                    }
                                }
                                .onMove(perform: moveItem)
                            }

//                                .onDelete(perform: deleteItem)
                        }

                        if showSuggestions {
                            SuggestedCategoriesView(income: income)
                        }
                    }
                    .scrollContentBackground(.hidden)
                    .scrollIndicators(.hidden)
                    .environment(\.editMode, .constant(self.isEditing ? EditMode.active : EditMode.inactive))
                } else {
                    List {
                        Section(header: Text("\(income ? "INCOME" : "EXPENSE") CATEGORIES").foregroundStyle(Color.SubtitleText)) {
                            if categories.isEmpty {
                                VStack(spacing: 10) {
                                    Image(systemName: "tray")
                                        .font(.system(.largeTitle, design: .rounded).weight(.light))
                                        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                                        .font(.system(size: 37, weight: .light))
                                        .foregroundStyle(Color.SubtitleText)

                                    Text("No \(income ? "income" : "expense") categories found,\nclick the 'New' button to add some.")
                                        .font(.system(.body, design: .rounded).weight(.medium))
                                        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                                        .font(.system(size: 17, weight: .medium, design: .rounded))
//                                        .italic()
                                        .multilineTextAlignment(.center)
                                        .foregroundStyle(Color.SubtitleText)
                                }
                                .frame(maxWidth: .infinity, alignment: .center)
                                .padding(.vertical, 37)
                                .listRowBackground(Color.SettingsBackground)
                            } else {
                                ForEach(categories) { category in
                                    HStack(spacing: 10) {
                                        Text(category.wrappedEmoji)
                                            .font(.system(.subheadline, design: .rounded))
                                            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                                            .font(.system(size: 15))
                                        Text(category.wrappedName)
                                            .font(.system(.body, design: .rounded))
                                            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                                            .font(.system(size: 18.5, weight: .regular, design: .rounded))
                                            .lineLimit(1)
                                            .foregroundStyle(toDelete == category ? Color.AlertRed : Color.PrimaryText)

                                        Spacer()

                                        if !income {
                                            RoundedRectangle(cornerRadius: 5, style: .continuous)
                                                .fill(Color(hex: category.wrappedColour))
                                                .frame(width: 20, height: 20)
                                        }
                                    }
                                    .padding(.vertical, 5)
                                    .listRowBackground(Color.SettingsBackground)
                                    .listRowSeparatorTint(Color.Outline)
                                    .contentShape(Rectangle())
                                    .onTapGesture {
                                        toEdit = category
                                    }
                                    .swipeActions(edge: .trailing) {
                                        Button {
                                            toDelete = category
                                        } label: {
                                            Image(systemName: "trash.fill")
                                        }
                                        .tint(Color.AlertRed)
                                    }
                                    .swipeActions(edge: .leading) {
                                        Button {
                                            toEdit = category
                                        } label: {
                                            Image(systemName: "pencil")
                                        }
                                        .tint(Color("Yellow"))
                                    }
                                }
                                .onMove(perform: moveItem)
                            }

//                                .onDelete(perform: deleteItem)
                        }

                        if showSuggestions {
                            SuggestedCategoriesView(income: income)
                        }
                    }
                    .environment(\.editMode, .constant(self.isEditing ? EditMode.active : EditMode.inactive))
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Color.PrimaryBackground)
        .animation(.easeOut(duration: 0.2), value: showToast)
        .onChange(of: toDelete) { _ in
            if toDelete != nil {
                deleteMode = true
            }
        }
        .fullScreenCover(isPresented: $deleteMode, onDismiss: {
            toDelete = nil
        }) {
            ZStack(alignment: .bottom) {
                Color.clear
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        deleteMode = false
                    }

                VStack(alignment: .leading, spacing: 1.5) {
                    Text("Delete '\(toDelete?.wrappedName ?? "")'?")
                        .font(.system(size: 20, weight: .medium, design: .rounded))
                        .foregroundStyle(Color.PrimaryText)

                    Text("This action cannot be undone, and all \(toDelete?.wrappedName ?? "") transactions would be deleted.")
                        .font(.system(size: 16, weight: .medium, design: .rounded))
                        .foregroundStyle(Color.SubtitleText)
                        .padding(.bottom, 15)

                    Button {
                        withAnimation {
                            if let gonnaDelete = toDelete {
                                moc.delete(gonnaDelete)
                            }

                            dataController.save()
                        }

                        toDelete = nil
                        deleteMode = false

                    } label: {
                        Text("Delete")
                            .font(.system(size: 20, weight: .semibold, design: .rounded))
                            .foregroundStyle(.white)
                            .frame(height: 45)
                            .frame(maxWidth: .infinity)
                            .background(Color.AlertRed, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                    }
                    .padding(.bottom, 8)

                    Button {
                        withAnimation(.easeOut(duration: 0.7)) {
                            deleteMode = false
                            offset = 0
                        }

                    } label: {
                        Text("Cancel")
                            .font(.system(size: 20, weight: .semibold, design: .rounded))
                            .foregroundStyle(Color.PrimaryText.opacity(0.9))
                            .frame(height: 45)
                            .frame(maxWidth: .infinity)
                            //                        .background(Color("13").opacity(0.23), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                            .background(Color.SecondaryBackground, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                    }
                }
                .padding(13)
                .background(RoundedRectangle(cornerRadius: 13).fill(Color.PrimaryBackground).shadow(color: systemColorScheme == .dark ? Color.clear : Color.gray.opacity(0.25), radius: 6))
                .overlay(RoundedRectangle(cornerRadius: 13).stroke(systemColorScheme == .dark ? Color.gray.opacity(0.1) : Color.clear, lineWidth: 1.3))
                .offset(y: offset)
                .gesture(
                    DragGesture()
                        .onChanged { gesture in
                            if gesture.translation.height < 0 {
                                offset = gesture.translation.height / 3
                            } else {
                                offset = gesture.translation.height
                            }
                        }
                        .onEnded { value in
                            if value.translation.height > 20 {
                                deleteMode = false
                                offset = 0
                            } else {
                                withAnimation {
                                    offset = 0
                                }
                            }
                        }
                )
                .padding(.horizontal, 17)
                .padding(.bottom, bottomEdge == 0 ? 13 : bottomEdge)
            }
            .edgesIgnoringSafeArea(.all)
            .background(BackgroundBlurView())
        }
        .sheet(item: $toEdit, onDismiss: {
            toEdit = nil
        }) { category in
            if #available(iOS 16.0, *) {
                EditCategoryAlert(toEdit: category, showRootToast: $showToast, rootToastTitle: $toastTitle, rootToastImage: $toastImage, positive: $positive, bottomSpacers: false)
                    .presentationDetents([.height(270)])
            } else {
                EditCategoryAlert(toEdit: category, showRootToast: $showToast, rootToastTitle: $toastTitle, rootToastImage: $toastImage, positive: $positive, bottomSpacers: true)
            }
        }
        .onChange(of: showToast) { newValue in
            if newValue {
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                    showToast = false
                }
            }
        }
        .onChange(of: showSuggestions) { newValue in
            if !newValue {
                toastTitle = "Suggestions Hidden"
                toastImage = "eye.slash"
                showToast = true
                positive = true
            }
        }
    }

    private func moveItem(at sets: IndexSet, destination: Int) {
        let itemToMove = sets.first!

        if itemToMove < destination {
            var startIndex = itemToMove + 1
            let endIndex = destination - 1
            var startOrder = categories[itemToMove].order
            while startIndex <= endIndex {
                categories[startIndex].order = startOrder
                startOrder = startOrder + 1
                startIndex = startIndex + 1
            }
            categories[itemToMove].order = startOrder
        } else if destination < itemToMove {
            var startIndex = destination
            let endIndex = itemToMove - 1
            var startOrder = categories[destination].order + 1
            let newOrder = categories[destination].order
            while startIndex <= endIndex {
                categories[startIndex].order = startOrder
                startOrder = startOrder + 1
                startIndex = startIndex + 1
            }
            categories[itemToMove].order = newOrder
        }

        do {
            dataController.save()
        } catch {
            print(error.localizedDescription)
        }
    }

    init(income: Binding<Bool>, mode: CategoryViewMode, showToast: Binding<Bool>, toastTitle: Binding<String>, toastImage: Binding<String>, positive: Binding<Bool>) {
        _categories = FetchRequest<Category>(sortDescriptors: [
            SortDescriptor(\.order)
        ], predicate: NSPredicate(format: "income = %d", income.wrappedValue))

        _income = income
        _showToast = showToast
        _toastTitle = toastTitle
        _toastImage = toastImage
        _positive = positive
        self.mode = mode
    }
}
