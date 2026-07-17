//
//  CategoryAlerts.swift
//  Outlayr
//

import Combine
import CoreHaptics
import Popovers
import SwiftUI
import UIKit

struct NewCategoryAlert: View {
    @Binding var income: Bool
    let budgetMode: Bool
    let bottomSpacers: Bool

    @Environment(\.dismiss) var dismiss
    @Environment(\.managedObjectContext) var moc
    @Environment(\.colorScheme) var systemColorScheme
    @Environment(DataController.self) private var dataController

    @Namespace var animation

    // existing categories

    @FetchRequest(sortDescriptors: [SortDescriptor(\.order)], predicate: NSPredicate(format: "income = %d", false)) private var expenseCategories: FetchedResults<Category>
    @FetchRequest(sortDescriptors: [SortDescriptor(\.order)], predicate: NSPredicate(format: "income = %d", true)) private var incomeCategories: FetchedResults<Category>
    @State private var availableColours: [String] = Color.colorArray

    // state
    @State private var newName = ""
    @State private var newEmoji = ""
    @State private var showingColourPicker = false
    @State private var selectedColour: String = "#FFFFFF"

    @FocusState var focusedField: FocusedField?

    enum FocusedField: Hashable {
        case emoji, name
    }

    // toasts
    @State var outcome = CategoryError.none
    @State var showToast = false
    @State var toastTitle = ""
    @State var toastImage = ""
    @State var positive = false

    var toastColor: Color {
        positive ? Color.IncomeGreen : Color.AlertRed
    }

    var addButtonDisabled: Bool {
        return newName.trimmingCharacters(in: .whitespacesAndNewlines) == "" || newEmoji == ""
    }

    @State var showNativePicker: Bool = false
    @State var customSelectedColor = Color.white

//    @State var isFetching = false

    var body: some View {
        VStack {
            VStack {
                VStack {
                    if showToast {
                        HStack(spacing: 5) {
                            Image(systemName: toastImage)
                                .font(.system(.subheadline, design: .rounded).weight(.semibold))
                                .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(toastColor)

                            Text(toastTitle)
                                .font(.system(.callout, design: .rounded).weight(.semibold))
                                .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                                .lineLimit(1)
//                                .font(.system(size: 16, weight: .semibold, design: .rounded))
                                .foregroundStyle(toastColor)
                        }
                        .padding(6)
                        .background(toastColor.opacity(0.23), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                        .transition(AnyTransition.opacity.combined(with: .move(edge: .top)))
                        .frame(maxWidth: 200)
                    } else {
                        if expenseCategories.count == 24 {
                            Text("Income Category")
                                .font(.system(.body, design: .rounded).weight(.semibold))
                                .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                                .font(.system(size: 18, weight: .semibold, design: .rounded))
                                .padding(.top, 4)
                        } else if budgetMode {
                            Text("Expense Category")
                                .font(.system(.body, design: .rounded).weight(.semibold))
                                .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                                .font(.system(size: 18, weight: .semibold, design: .rounded))
                                .padding(.top, 4)
                        } else {
                            HStack(spacing: 0) {
                                Text("Expense")
                                    .font(.system(.callout, design: .rounded).weight(.semibold))
                                    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                                    .font(.system(size: 16, weight: .semibold, design: .rounded))
                                    .foregroundStyle(income == false ? Color.PrimaryText : Color.SubtitleText)
                                    .padding(5)
                                    .padding(.horizontal, 7)
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
                                    .font(.system(.callout, design: .rounded).weight(.semibold))
                                    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                                    .font(.system(size: 16, weight: .semibold, design: .rounded))
                                    .foregroundStyle(income == true ? Color.PrimaryText : Color.SubtitleText)
                                    .padding(5)
                                    .padding(.horizontal, 7)
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
                            .background(Capsule().fill(Color.PrimaryBackground).shadow(color: systemColorScheme == .light ? Color.Outline : Color.clear, radius: 6))
                            .overlay(Capsule().stroke(systemColorScheme == .light ? Color.clear : Color.Outline.opacity(0.4), lineWidth: 1.3))
                        }
                    }
                }
                .frame(height: 30)
                .frame(maxWidth: .infinity)
                .overlay(alignment: .leading) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(.callout, design: .rounded).weight(.semibold))
                            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Color.SubtitleText)
                            .padding(7)
                            .background(Color.SecondaryBackground, in: Circle())
                            .contentShape(Circle())
                    }
                }

                Spacer()

                ZStack {
                    EmojiTextField(text: $newEmoji)
                        .focused($focusedField, equals: .emoji)
                        .onReceive(Just(newEmoji), perform: { _ in
                            if String(self.newEmoji.onlyEmoji().suffix(1)) != self.newEmoji.onlyEmoji().prefix(1) {
                                self.newEmoji = String(self.newEmoji.onlyEmoji().suffix(1))
                            } else {
                                self.newEmoji = String(self.newEmoji.onlyEmoji().prefix(1))
                            }
                        })
                        .font(.system(size: 160))
                        .padding(8)
                        .frame(width: 80, height: 80, alignment: .center)
                        .background {
                            RoundedRectangle(cornerRadius: 13, style: .continuous)
                                .strokeBorder((focusedField == .emoji && !showingColourPicker) ? Color.SubtitleText : Color.clear, lineWidth: 2.2)
                                .background(RoundedRectangle(cornerRadius: 13, style: .continuous).fill(Color.SecondaryBackground))
                        }

                    if newEmoji == "" {
                        Image("emoji-happy")
                            .resizable()
                            .foregroundStyle(Color.PrimaryText)
                            .frame(width: 35, height: 35, alignment: .center)
                            .allowsHitTesting(false)
                    }
                }

                Spacer()

                HStack {
                    if !income {
                        Button {
                            showingColourPicker = true
                        } label: {
                            RoundedRectangle(cornerRadius: 9, style: .continuous)
                                .fill(Color(hex: selectedColour))
                                .padding(8)
                                .background(Color.SecondaryBackground, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
                                .frame(width: 50, height: 50)
                                .overlay {
                                    if showingColourPicker {
                                        RoundedRectangle(cornerRadius: 13, style: .continuous)
                                            .stroke(Color.SubtitleText, lineWidth: 2.2)
                                    }
                                }
                        }
                        .popover(present: $showingColourPicker, attributes: {
                            $0.position = .absolute(
                                originAnchor: .topLeft,
                                popoverAnchor: .bottomLeft
                            )
                            $0.rubberBandingMode = .none
                            $0.sourceFrameInset = UIEdgeInsets(top: -10, left: 0, bottom: 0, right: 0)
                            $0.presentation.animation = .easeInOut(duration: 0.2)
                            $0.dismissal.animation = .easeInOut(duration: 0.3)
                        }) {
                            ColourPickerView(selectedColor: $selectedColour, showMenu: $showingColourPicker, showNativePicker: $showNativePicker)
                                .environment(\.managedObjectContext, self.moc)

                        } background: {
                            Color.PrimaryBackground.opacity(0.3)
                        }
                    }
//
//                    HStack(spacing: 8) {
//
//
//                        if isFetching {
//                            ProgressView()
//                                .padding(8)
//                        } else if newName != "" {
//                            Image(systemName: "xmark.circle.fill")
//                                .foregroundStyle(Color.SubtitleText)
//                                .font(.system(size: 20, weight: .semibold))
//                                .padding(8)
//                                .onTapGesture {
//                                    withAnimation {
//                                        newName = ""
//                                    }
//                                }
//                        }
//                    }
                    NormalTextField(text: $newName, placeholder: "Category Name", action: verification)
                        .focused($focusedField, equals: .name)
                        .padding(.horizontal, 15)
                        .padding(.vertical, 5)
                        .foregroundStyle(Color.PrimaryText)

                        .frame(height: 50)
                        .background {
                            RoundedRectangle(cornerRadius: 13, style: .continuous)
                                .strokeBorder((focusedField == .name && !showingColourPicker) ? Color.SubtitleText : Color.clear, lineWidth: 2.2)
                                .background(RoundedRectangle(cornerRadius: 13, style: .continuous).fill(Color.SecondaryBackground))
                        }
                    //
                    Button {
                        verification()
                    } label: {
                        Image(systemName: "plus")
                            .foregroundStyle(Color.LightIcon)
                            .font(.system(.title3, design: .rounded).weight(.semibold))
                            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                            .font(.system(size: 20, weight: .semibold))
                            .frame(width: 50, height: 50)
                            .background(Color.DarkBackground, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
                    }
                }
            }
            .padding(13)
            .frame(maxHeight: bottomSpacers ? 350 : .infinity)
        }
        .frame(maxHeight: .infinity, alignment: .top)
        .background(Color.PrimaryBackground)
        .animation(.easeOut(duration: 0.2), value: showToast)
        .onChange(of: expenseCategories.count) { _, _ in
            if expenseCategories.count == 24 {
                dismiss()
            }
        }
        .onChange(of: showToast) { _, newValue in
            if newValue {
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                    showToast = false
                }
            }
        }
        .onChange(of: customSelectedColor) { _, _ in
            selectedColour = customSelectedColor.toHex() ?? "#FFFFFF"
        }
        .colorPickerSheet(isPresented: $showNativePicker, selection: $customSelectedColor, supportsAlpha: false, title: "")
        .onAppear {
            if expenseCategories.count == 24 {
                income = true
            }

            if !income {
                expenseCategories.forEach { category in
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

    func verification() {
        let results = dataController.categoryCheck(name: newName, emoji: newEmoji, income: income)

        outcome = results.error

        if outcome != .none {
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.error)

            switch outcome {
            case .incomplete:
                toastTitle = "Incomplete Entry"
                toastImage = "questionmark.app"
            case .missingEmoji:
                toastTitle = "Missing Emoji"
                toastImage = "person.fill"

                focusedField = .emoji
            case .missingName:
                toastTitle = "Missing Name"
                toastImage = "character.cursor.ibeam"

                focusedField = .name
            case .duplicate:
                toastTitle = "Duplicate Found"
                toastImage = "externaldrive"
            case .duplicateEmoji:
                toastTitle = "Duplicate Emoji"
                toastImage = "person.fill"

                focusedField = .emoji
            case .duplicateName:
                toastTitle = "Duplicate Name"
                toastImage = "character.cursor.ibeam"

                focusedField = .name
            default:
                return
            }

            positive = false
            showToast = true

        } else {
            toastTitle = "Added \(newName)"

            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.success)

            if income {
                let category = Category(context: moc)
                category.name = newName.trimmingCharacters(in: .whitespaces).capitalized
                category.emoji = newEmoji
                category.dateCreated = Date.now
                category.id = UUID()
                category.colour = "IncomeGreen"
                category.order = results.order
                category.income = true
                dataController.save()

                newName = ""
                newEmoji = ""
            } else {
                let category = Category(context: moc)
                category.name = newName.trimmingCharacters(in: .whitespaces).capitalized
                category.emoji = newEmoji
                category.dateCreated = Date.now
                category.id = UUID()
                category.income = false

                category.colour = selectedColour
                category.order = results.order

                dataController.save()

                newName = ""
                newEmoji = ""

                availableColours = Color.colorArray
                expenseCategories.forEach { category in
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

            if budgetMode {
                dismiss()
                return
            } else {
                focusedField = .emoji
                toastImage = "checkmark.circle.fill"
                positive = true
                showToast = true
            }
        }
    }

//    func GPTRecommendations(emoji: String, income: Bool) {
//        guard let url = URL(string: "https://api.openai.com/v1/completions") else {
//            return
//        }
//
//        var request = URLRequest(url: url)
//        request.httpMethod = "POST"
//
//        let parameters: [String:Any] = ["model":"text-davinci-003", "prompt":"What is the likely transaction category name for a \(income ? "income" : "expense") category with the emoji \(emoji)?", "temperature":0.9]
//
//        // Convert parameters into JSON data
//        let postData = try? JSONSerialization.data(withJSONObject: parameters)
//
//        request.httpBody = postData
//        request.addValue("Bearer \(Constants.openAPIKey)", forHTTPHeaderField: "Authorization")
//        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
//
//        isFetching = true
//
//        let task = URLSession.shared.dataTask(with: request) { (data, response, error) in
//            DispatchQueue.main.async {
//
//                if let data = data {
//                    let decoder = JSONDecoder()
//
//                    do {
//                        // Decode data using your model structure
//                        let result = try decoder.decode(OpenAICompletionsResponse.self, from: data)
//                        self.newName = result.choices.first?.text.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
//                        isFetching = false
//                    } catch {
//                        print("Failed to decode JSON")
//                        isFetching = false
//                    }
//                } else if let error = error {
//                    print("HTTP Request Failed \(error.localizedDescription)")
//                    isFetching = false
//                }
//            }
//        }
//
//        task.resume()
//    }

    init(income: Binding<Bool>, bottomSpacers: Bool, budgetMode: Bool = false) {
        _income = income
        self.budgetMode = budgetMode
        self.bottomSpacers = bottomSpacers
    }
}

struct EditCategoryAlert: View {
    let toEdit: Category
    @Binding var showRootToast: Bool
    @Binding var rootToastTitle: String
    @Binding var rootToastImage: String
    @Binding var positive: Bool

    let bottomSpacers: Bool

    @Environment(\.dismiss) var dismiss
    @Environment(\.managedObjectContext) var moc
    @Environment(\.colorScheme) var systemColorScheme
    @Environment(DataController.self) private var dataController

    @Namespace var animation

    // existing categories

    @FetchRequest(sortDescriptors: [SortDescriptor(\.order)], predicate: NSPredicate(format: "income = %d", false)) private var expenseCategories: FetchedResults<Category>

    // state
    @State private var newName = ""
    @State private var newEmoji = ""
    @State private var showingColourPicker = false
    @State private var selectedColour: String = "#FFFFFF"

    @FocusState var focusedField: FocusedField?

    enum FocusedField: Hashable {
        case emoji, name
    }

    // toasts
    @State var outcome = CategoryError.none
    @State var showToast = false
    @State var toastTitle = ""
    @State var toastImage = ""

    // delete mode
    @State private var deleteMode = false
    @State private var toDelete: Category?
    var alertMessage: String {
        "Delete '" + (toDelete?.wrappedName ?? "") + "'?"
    }

    @State var showNativePicker: Bool = false
    @State var customSelectedColor = Color.white

    var body: some View {
        VStack {
            VStack {
                HStack {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(.callout, design: .rounded).weight(.semibold))
                            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Color.SubtitleText)
                            .padding(7)
                            .background(Color.SecondaryBackground, in: Circle())
                            .contentShape(Circle())
                    }

                    Spacer()

                    if showToast {
                        HStack(spacing: 5) {
                            Image(systemName: toastImage)
                                .font(.system(.subheadline, design: .rounded).weight(.semibold))
                                .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(Color.AlertRed)

                            Text(toastTitle)
                                .font(.system(.callout, design: .rounded).weight(.semibold))
                                .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                                .lineLimit(1)
//                                .font(.system(size: 16, weight: .semibold, design: .rounded))
                                .foregroundStyle(Color.AlertRed)
                        }
                        .padding(6)
                        .background(Color.AlertRed.opacity(0.23), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                        .transition(AnyTransition.opacity.combined(with: .move(edge: .top)))
                        .frame(maxWidth: 200)
                    } else {
                        Text(toEdit.income ? "Income" : "Expense")
                            .font(.system(.body, design: .rounded).weight(.semibold))
                            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                            .font(.system(size: 18, weight: .semibold, design: .rounded))
                    }

                    Spacer()

                    Button {
                        toDelete = toEdit
                    } label: {
                        Image(systemName: "trash.fill")
                            .font(.system(.callout, design: .rounded).weight(.semibold))
                            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Color.AlertRed)
                            .padding(7)
                            .background(Color.AlertRed.opacity(0.23), in: Circle())
                            .contentShape(Circle())
                    }
                }
                .frame(height: 30)

                Spacer()

                ZStack {
                    EmojiTextField(text: $newEmoji)
                        .focused($focusedField, equals: .emoji)
                        .onReceive(Just(newEmoji), perform: { _ in
                            if String(self.newEmoji.onlyEmoji().suffix(1)) != self.newEmoji.onlyEmoji().prefix(1) {
                                self.newEmoji = String(self.newEmoji.onlyEmoji().suffix(1))
                            } else {
                                self.newEmoji = String(self.newEmoji.onlyEmoji().prefix(1))
                            }
                        })
                        .font(.system(size: 160))
                        .padding(8)
                        .frame(width: 80, height: 80, alignment: .center)
                        .background {
                            RoundedRectangle(cornerRadius: 13, style: .continuous)
                                .strokeBorder((focusedField == .emoji && !showingColourPicker) ? Color.SubtitleText : Color.clear, lineWidth: 2.2)
                                .background(RoundedRectangle(cornerRadius: 13, style: .continuous).fill(Color.SecondaryBackground))
                        }

                    if newEmoji == "" {
                        Image("emoji-happy")
                            .resizable()
                            .foregroundStyle(Color.PrimaryText)
                            .frame(width: 35, height: 35, alignment: .center)
                            .allowsHitTesting(false)
                    }
                }

                Spacer()

                HStack {
                    if !toEdit.income {
                        Button {
                            showingColourPicker = true
                        } label: {
                            RoundedRectangle(cornerRadius: 9, style: .continuous)
                                .fill(Color(hex: selectedColour))
                                .padding(8)
                                .background(Color.SecondaryBackground, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
                                .frame(width: 50, height: 50)
                                .overlay {
                                    if showingColourPicker {
                                        RoundedRectangle(cornerRadius: 13, style: .continuous)
                                            .stroke(Color.SubtitleText, lineWidth: 2.2)
                                    }
                                }
                        }
                        .popover(present: $showingColourPicker, attributes: {
                            $0.position = .absolute(
                                originAnchor: .topLeft,
                                popoverAnchor: .bottomLeft
                            )
                            $0.rubberBandingMode = .none
                            $0.sourceFrameInset = UIEdgeInsets(top: -10, left: 0, bottom: 0, right: 0)
                            $0.presentation.animation = .easeInOut(duration: 0.2)
                            $0.dismissal.animation = .easeInOut(duration: 0.3)
                        }) {
                            ColourPickerView(selectedColor: $selectedColour, showMenu: $showingColourPicker, showNativePicker: $showNativePicker, toEdit: toEdit)
                                .environment(\.managedObjectContext, self.moc)

                        } background: {
                            Color.PrimaryBackground.opacity(0.3)
                        }
                    }

                    NormalTextField(text: $newName, placeholder: "Category Name", action: verification)
                        .focused($focusedField, equals: .name)
                        .padding(.horizontal, 15)
                        .padding(.vertical, 5)
                        .frame(height: 50)
                        .foregroundStyle(Color.PrimaryText)
                        .background {
                            RoundedRectangle(cornerRadius: 13, style: .continuous)
                                .strokeBorder((focusedField == .name && !showingColourPicker) ? Color.SubtitleText : Color.clear, lineWidth: 2.2)
                                .background(RoundedRectangle(cornerRadius: 13, style: .continuous).fill(Color.SecondaryBackground))
                        }

                    Button {
                        verification()
                    } label: {
                        Image(systemName: "checkmark")
                            .foregroundStyle(Color.LightIcon)
                            .font(.system(.title3, design: .rounded).weight(.semibold))
                            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                            .font(.system(size: 20, weight: .semibold))
                            .frame(width: 50, height: 50)
                            .background(Color.DarkBackground, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
                    }
                }
            }
            .padding(13)
            .frame(maxHeight: bottomSpacers ? 350 : .infinity)
        }
        .frame(maxHeight: .infinity, alignment: .top)
        .background(Color.PrimaryBackground)
        .animation(.easeOut(duration: 0.2), value: showToast)
        .onChange(of: showToast) { _, newValue in
            if newValue {
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                    showToast = false
                }
            }
        }
        .fullScreenCover(item: $toDelete, onDismiss: {
            toDelete = nil
        }) { category in
            DeleteCategoryAlert(toDelete: category, deleted: $deleteMode)
        }
        .onChange(of: expenseCategories.count) { _, _ in
            if expenseCategories.count == 24 {
                dismiss()
            }
        }
        .onChange(of: customSelectedColor) { _, _ in
            print("changed")
            selectedColour = customSelectedColor.toHex() ?? "#FFFFFF"
        }
        .colorPickerSheet(isPresented: $showNativePicker, selection: $customSelectedColor, supportsAlpha: false, title: "")
        .onChange(of: deleteMode) { _, _ in
            dismiss()
        }
        .onAppear {
            newName = toEdit.wrappedName
            newEmoji = toEdit.wrappedEmoji
            selectedColour = toEdit.wrappedColour
        }
    }

    func verification() {
        let results = dataController.categoryCheckEdit(name: newName, emoji: newEmoji, toEdit: toEdit)

        outcome = results.error

        if outcome != .none {
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.error)

            switch outcome {
            case .incomplete:
                toastTitle = "Incomplete Entry"
                toastImage = "questionmark.app"
            case .missingEmoji:
                toastTitle = "Missing Emoji"
                toastImage = "person.fill"

                focusedField = .emoji
            case .missingName:
                toastTitle = "Missing Name"
                toastImage = "character.cursor.ibeam"

                focusedField = .name
            case .duplicate:
                toastTitle = "Duplicate Found"
                toastImage = "externaldrive"
            case .duplicateEmoji:
                toastTitle = "Duplicate Emoji"
                toastImage = "person.fill"

                focusedField = .emoji
            case .duplicateName:
                toastTitle = "Duplicate Name"
                toastImage = "character.cursor.ibeam"

                focusedField = .name
            default:
                return
            }

            showToast = true
        } else {
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.success)

            if toEdit.income {
                toEdit.name = newName.trimmingCharacters(in: .whitespaces).capitalized
                toEdit.emoji = newEmoji

                dataController.save()
            } else {
                toEdit.name = newName.trimmingCharacters(in: .whitespaces).capitalized
                toEdit.emoji = newEmoji
                toEdit.colour = selectedColour

                dataController.save()
            }

            rootToastTitle = "Edited \(newName)"
            rootToastImage = "checkmark.circle.fill"
            positive = true
            showRootToast = true

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                dismiss()
            }
        }
    }
}

struct DeleteCategoryAlert: View {
    @Environment(\.managedObjectContext) var moc
    @Environment(DataController.self) private var dataController
    @Environment(\.dismiss) var dismiss
    let toDelete: Category
    @Binding var deleted: Bool
    @Environment(\.colorScheme) var systemColorScheme

    @AppStorage("bottomEdge", store: AppIdentifiers.sharedDefaults) var bottomEdge: Double = 15

    @State private var offset: CGFloat = 0

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.clear
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .contentShape(Rectangle())
                .onTapGesture {
                    dismiss()
                }

            VStack(alignment: .leading, spacing: 1.5) {
                Text("Delete '\(toDelete.wrappedName)'?")
                    .font(.system(.title2, design: .rounded).weight(.medium))
                    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                    .font(.system(size: 20, weight: .medium, design: .rounded))
                    .foregroundStyle(Color.PrimaryText)

                Text("This action cannot be undone.")
                    .font(.system(.title3, design: .rounded).weight(.medium))
                    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                    .font(.system(size: 16, weight: .medium, design: .rounded))
                    .foregroundStyle(Color.SubtitleText)
                    .padding(.bottom, 15)
                    .accessibility(hidden: true)

                Button {
                    deleted = true
                    dismiss()

                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                        withAnimation {
                            moc.delete(toDelete)
                            dataController.save()
                        }
                    }

                } label: {
                    Text("Delete")
                        .font(.system(.title3, design: .rounded).weight(.semibold))
                        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                        .foregroundStyle(.white)
                        .frame(height: 45)
                        .frame(maxWidth: .infinity)
                        .background(Color.AlertRed, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                }
                .padding(.bottom, 8)

                Button {
                    withAnimation(.easeOut(duration: 0.7)) {
                        dismiss()
                    }

                } label: {
                    Text("Cancel")
                        .font(.system(.title3, design: .rounded).weight(.semibold))
                        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
//                        .font(.system(size: 20, weight: .semibold, design: .rounded))
                        .foregroundStyle(Color.PrimaryText.opacity(0.9))
                        .frame(height: 45)
                        .frame(maxWidth: .infinity)
                        .background(Color.SecondaryBackground, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                }
            }
            .padding(13)
//            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
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
                            dismiss()
                        } else {
                            withAnimation {
                                offset = 0
                            }
                        }
                    }
            )
//            .gesture(DragGesture(minimumDistance: 0, coordinateSpace: .local)
//                .onEnded({ value in
//                    if value.translation.height > 0 {
//                        dismiss()
//                    }
//                }))
            .padding(.horizontal, 17)
            .padding(.bottom, bottomEdge == 0 ? 13 : bottomEdge)
        }
        .edgesIgnoringSafeArea(.all)
        .background(BackgroundBlurView())
    }
}
