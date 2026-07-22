//
//  TemplateTransactionView.swift
//  Outlayr
//
//  Created by Rafael Soh on 4/9/23.
//

import Foundation
import Popovers
import SwiftUI
import WidgetKit

struct TemplateTransactionView: View {
    @Environment(\.managedObjectContext) var moc
    @Environment(DataController.self) private var dataController
    @Environment(\.dismiss) var dismiss

    @AppStorage(DefaultsKey.numberEntryType, store: AppIdentifiers.sharedDefaults) var numberEntryType: Int = 1

    @Environment(\.colorScheme) var colorScheme

    @AppStorage(DefaultsKey.topEdge, store: AppIdentifiers.sharedDefaults) var topEdge: Double = 30

    @State private var note = ""
    @State var category: Category?
    @State private var repeatType = 0
    @State private var repeatCoefficient = 1
    @State private var showRecurring = false
    @State var income = false

    var transactionTypeString: String {
        if income {
            return "Income"
        } else {
            return "Expense"
        }
    }

    @State private var numbers: [Int] = [0, 0, 0]
    @State private var numbers1: [String] = []
    private var amount: String {
        var string = ""

        if numberEntryType == 1 {
            for i in numbers.indices {
                if i == (numbers.count - 2) {
                    string += ".\(numbers[i])"
                } else {
                    string += "\(numbers[i])"
                }
            }

            return string
        } else {
            if numbers1.isEmpty {
                return "0"
            }
            for i in numbers1 {
                string = string + i
            }

            return string
        }
    }

    var transactionValue: Double {
        return (amount as NSString).doubleValue
    }

    @State var showCategoryPicker = false
    @State var showCategorySheet = false

    @AppStorage(DefaultsKey.currency, store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency)!
    }

    @State var showingCategoryView = false

    // toasts
    @State var showToast = false
    @State var toastTitle = ""
    @State var toastImage = ""

    @AppStorage(DefaultsKey.firstTransactionViewLaunch, store: AppIdentifiers.sharedDefaults) var firstLaunch: Bool = true

    // edit mode
    let toEdit: TemplateTransaction?

    // delete mode

    @State var toDelete: TemplateTransaction?
    @State var deleteMode = false

    @AppStorage(DefaultsKey.bottomEdge, store: AppIdentifiers.sharedDefaults) var bottomEdge: Double = 15

    let repeatOverlays = ["D", "W", "M"]

    func downsize(availableWidth: CGFloat) -> (big: CGFloat, small: CGFloat) {
        let amountText: String
        let size = availableWidth - 105

        if numberEntryType == 2 {
            amountText = amount
        } else {
            amountText = String(format: "%.2f", transactionValue)
        }

        if (amountText.widthOfRoundedString(size: 32, weight: .regular) + currencySymbol.widthOfRoundedString(size: 20, weight: .light) + 4) > size {
            return (24, 16)
        } else if (amountText.widthOfRoundedString(size: 44, weight: .regular) + currencySymbol.widthOfRoundedString(size: 25, weight: .light) + 4) > size {
            return (32, 20)
        } else if (amountText.widthOfRoundedString(size: 56, weight: .regular) + currencySymbol.widthOfRoundedString(size: 32, weight: .light) + 4) > size {
            return (44, 25)
        } else {
            return (56, 32)
        }
    }

    var repeatButtonAccessibility: String {
        if repeatType == 1 {
            return "transaction recurs daily, button to edit recurring duration"
        } else if repeatType == 2 {
            return "transaction recurs weekly, button to edit recurring duration"
        } else if repeatType == 3 {
            return "transaction recurs monthly, button to edit recurring duration"
        } else {
            return "button to make transaction recurring"
        }
    }

    @AppStorage(DefaultsKey.colorScheme, store: AppIdentifiers.sharedDefaults) var selectedAppearance: Int = 0

    @Environment(\.colorScheme) var systemColorScheme

    var darkMode: Bool {
        (selectedAppearance == 0 && systemColorScheme == .dark) || selectedAppearance == 2
    }

    var backgroundColor: Color {
        if darkMode {
            return Color("AlwaysDarkBackground")
        } else {
            return Color("AlwaysLightBackground")
        }
    }

    @State var showPicker = false
    @State var animateIcon = false

    let order: Int

    var body: some View {
//        ScrollView {
        GeometryReader { proxy in
            VStack(spacing: 8) {
                // income/expense picker
                VStack {
                    if showToast {
                        HStack(spacing: 6.5) {
                            Image(systemName: toastImage)
                                .scaledFont(15, weight: .semibold)
                                .foregroundStyle(Color.AlertRed)

                            Text(toastTitle)
                                .scaledFont(16, weight: .semibold, design: .rounded)
                                .foregroundStyle(Color.AlertRed)
                        }
                        .padding(8)
                        .background(Color.AlertRed.opacity(0.23), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                        .transition(AnyTransition.opacity.combined(with: .move(edge: .top)))
                        .frame(maxWidth: 200)
                    } else {
                        Picker("Type", selection: $income) {
                            Text("Expense").tag(false)
                            Text("transaction-view-income-picker").tag(true)
                        }
                        .pickerStyle(.segmented)
                        .onChange(of: income) { _, _ in category = nil }
                    }
                }
                .frame(height: 35)
                .frame(maxWidth: .infinity)
                .overlay {
                    HStack {
                        Button {
                            dismiss()
                        } label: {
                            Image(systemName: "xmark")
                                .scaledFont(16, weight: .semibold)
                                .foregroundStyle(Color.SubtitleText)
                                .padding(7)
                                .background(Color.SecondaryBackground, in: Circle())
                                .contentShape(Circle())
                        }

                        Spacer()

                        if toEdit != nil {
                            Button {
                                toDelete = toEdit
                                deleteMode = true

                            } label: {
                                Image(systemName: "trash.fill")
                                    .scaledFont(16, weight: .semibold)
                                    .foregroundStyle(Color.AlertRed)
                                    .padding(7)
                                    .background(Color.AlertRed.opacity(0.23), in: Circle())
                                    .contentShape(Circle())
                            }
                            .accessibilityLabel(String(localized: "accessibility.deleteTransaction"))
                        }

                        Button {
                            showRecurring = true
                        } label: {
                            if repeatType > 0 {
                                Image(systemName: "repeat")
                                    .scaledFont(16, weight: .semibold)
                                    .overlay(alignment: .topTrailing) {
                                        Text(repeatOverlays[repeatType - 1])
                                            .scaledFont(6, weight: .black, design: .rounded)
                                            .foregroundStyle(Color.IncomeGreen)
                                            .frame(width: 10, alignment: .leading)
                                            .offset(x: 5.7, y: 1.5)
                                    }
                                    .foregroundStyle(Color.IncomeGreen)
                                    .padding(7)
                                    .background(Color.IncomeGreen.opacity(0.23), in: Circle())
                                    .contentShape(Circle())
                            } else {
                                Image(systemName: "repeat")
                                    .scaledFont(16, weight: .semibold)
                                    .foregroundStyle(Color.SubtitleText)
                                    .padding(7)
                                    .background(Color.SecondaryBackground, in: Circle())
                                    .contentShape(Circle())
                            }
                        }
                        .accessibilityRemoveTraits(.isButton)
                        .accessibilityLabel(repeatButtonAccessibility)
                        .popover(present: $showRecurring, attributes: {
                            $0.position = .absolute(
                                originAnchor: .bottom,
                                popoverAnchor: .top
                            )
                            $0.rubberBandingMode = .none
                            $0.sourceFrameInset = UIEdgeInsets(top: 0, left: 0, bottom: -10, right: 0)
                            $0.presentation.animation = .easeInOut(duration: 0.2)
                            $0.dismissal.animation = .easeInOut(duration: 0.3)
                        }) {
                            RecurringPickerView(repeatType: $repeatType, repeatCoefficient: $repeatCoefficient, showMenu: $showRecurring, showPicker: $showPicker)
                        } background: {
                            backgroundColor.opacity(0.6)
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
                .padding(.top, topEdge)

                // number display and note view
                VStack(spacing: 8) {
                    if numberEntryType == 1 {
                        HStack(alignment: .lastTextBaseline, spacing: 4) {
                            Text(currencySymbol)
                                .scaledFont(downsize(availableWidth: proxy.size.width).small, weight: .light, design: .rounded)
                                .foregroundStyle(Color.SubtitleText)
                                .baselineOffset(getDollarOffset(big: downsize(availableWidth: proxy.size.width).big, small: downsize(availableWidth: proxy.size.width).small))
                            Text("\(transactionValue, specifier: "%.2f")")
                                .scaledFont(downsize(availableWidth: proxy.size.width).big, weight: .regular, design: .rounded)
                                .foregroundStyle(Color.PrimaryText)
                        }
                    } else {
                        if numbers1.isEmpty {
                            HStack(alignment: .lastTextBaseline, spacing: 4) {
                                Text(currencySymbol)
                                    .scaledFont(32, weight: .light, design: .rounded)
                                    .foregroundStyle(Color.SubtitleText)
                                    .baselineOffset(getDollarOffset(big: 56, small: 32))
                                Text("0")
                                    .scaledFont(56, weight: .regular, design: .rounded)
                                    .foregroundStyle(Color.PrimaryText)
                            }
                            .frame(maxWidth: .infinity)
                        } else {
                            HStack(alignment: .lastTextBaseline, spacing: 4) {
                                Text(currencySymbol)
                                    .scaledFont(downsize(availableWidth: proxy.size.width).small, weight: .light, design: .rounded)
                                    .foregroundStyle(Color.SubtitleText)
                                    .baselineOffset(getDollarOffset(big: downsize(availableWidth: proxy.size.width).big, small: downsize(availableWidth: proxy.size.width).small))
                                Text(amount)
                                    .scaledFont(downsize(availableWidth: proxy.size.width).big, weight: .regular, design: .rounded)
                                    .foregroundStyle(Color.PrimaryText)
                            }
                            .frame(maxWidth: .infinity)
                            .overlay(alignment: .trailing) {
                                TemplateTransactionNumPad.DeleteButton(numbers1: $numbers1)
                            }
                        }
                    }

                    NoteView(note: $note, focused: Binding.constant(false))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)

                // date and category picker
                CategoryRowPickerView(category: $category, income: income)
                    .padding(.bottom, 5)

                // num pad
                TemplateTransactionNumPad(
                    numberEntryType: numberEntryType,
                    numbers: $numbers,
                    numbers1: $numbers1,
                    submit: submit
                )
            }
            .padding(17)
            .frame(width: proxy.size.width, height: proxy.size.height)
            .background(Color.PrimaryBackground)
            .onTapGesture {
                self.hideKeyboard()
            }
            .fullScreenCover(isPresented: $deleteMode) {
                TemplateTransactionDeleteSheet(
                    isPresented: $deleteMode,
                    toDelete: $toDelete,
                    bottomEdge: bottomEdge,
                    systemColorScheme: systemColorScheme
                ) {
                    if let itemToDelete = toDelete {
                        moc.delete(itemToDelete)
                    }
                    try? dataController.save()
                    dismiss()
                }
            }
        }
        .animation(.easeOut(duration: 0.2), value: showToast)
        .ignoresSafeArea(.keyboard, edges: .all)
        .frame(maxHeight: .infinity)
        .background(Color.PrimaryBackground)
        .ignoresSafeArea()
        .onChange(of: showToast) { _, newValue in
            if newValue {
                Task {
                    try? await Task.sleep(for: .seconds(2))
                    showToast = false
                }
            }
        }
        .onAppear {
            if let transaction = toEdit {
                let string = String(format: "%.2f", transaction.wrappedAmount)

                var stringArray = string.compactMap { String($0) }

                numbers = stringArray.compactMap { Int($0) }

                if round(transaction.wrappedAmount) == transaction.wrappedAmount {
                    stringArray.removeLast()
                    stringArray.removeLast()
                    stringArray.removeLast()
                    numbers1 = stringArray
                } else {
                    numbers1 = stringArray
                }
            }
        }
        .sheet(isPresented: $showCategorySheet) {
            CategoryView(mode: .transaction, income: income)
        }
        .sheet(isPresented: $showPicker) {
            CustomRecurringView(repeatType: $repeatType, repeatCoefficient: $repeatCoefficient, showPicker: $showPicker)
                .presentationDetents([.height(230)])
        }
    }

    func submit() {
        let generator = UINotificationFeedbackGenerator()

        if transactionValue == 0 && category == nil {
            toastImage = "questionmark.app"
            toastTitle = "Incomplete Entry"
            showToast = true
            generator.notificationOccurred(.error)

            return
        } else if transactionValue == 0 {
            toastImage = "centsign.circle"
            toastTitle = "Missing Amount"
            showToast = true
            generator.notificationOccurred(.error)
            return
        } else if category == nil {
            toastImage = "tray"
            toastTitle = "Missing Category"
            showToast = true
            generator.notificationOccurred(.error)
            return
        }

        generator.notificationOccurred(.success)

        if let editedTransaction = toEdit {
            if note.trimmingCharacters(in: .whitespacesAndNewlines) == "" {
                editedTransaction.note = category!.wrappedName
            } else {
                editedTransaction.note = note.trimmingCharacters(in: .whitespaces)
            }

            if let unwrappedCategory = category {
                editedTransaction.category = unwrappedCategory
            }

            editedTransaction.amount = transactionValue
            editedTransaction.income = income

            editedTransaction.recurringType = Int16(repeatType)
            editedTransaction.recurringCoefficient = Int16(repeatCoefficient)

            try? dataController.save()

            dismiss()

        } else {
            let transaction = TemplateTransaction(context: moc)
            if note.trimmingCharacters(in: .whitespacesAndNewlines) == "" {
                transaction.note = category?.wrappedName ?? ""
            } else {
                transaction.note = note.trimmingCharacters(in: .whitespaces)
            }

            transaction.income = income

            if let unwrappedCategory = category {
                transaction.category = unwrappedCategory
            }

            transaction.amount = transactionValue
            transaction.id = UUID()
            transaction.order = Int16(order)

            transaction.recurringType = Int16(repeatType)
            transaction.recurringCoefficient = Int16(repeatCoefficient)

            try? dataController.save()

            dismiss()
        }

        WidgetCenter.shared.reloadAllTimelines()
    }

    init(order: Int) {

        let dataController = DataController.shared

        let toEdit = dataController.transactions.getTemplateTransaction(order: order)

        if let transaction = toEdit {
            _note = State(initialValue: transaction.wrappedNote)

            if let unwrappedCategory = transaction.category {
                _category = State(initialValue: unwrappedCategory)
                print(unwrappedCategory.wrappedName)
                print("FOUND IT")
            } else {
                print("CANNOT FIND")
            }

            _income = State(initialValue: transaction.income)

            _repeatType = State(initialValue: Int(transaction.recurringType))
            _repeatCoefficient = State(initialValue: Int(transaction.recurringCoefficient))

            print("IM HERE")
        }

        self.order = order
        self.toEdit = toEdit
    }
}

private struct TemplateTransactionNumPad: View {
    let numberEntryType: Int
    @Binding var numbers: [Int]
    @Binding var numbers1: [String]
    let submit: () -> Void

    var numberArrayCount: Int {
        numberEntryType == 1 ? numbers.count : numbers1.count
    }

    var body: some View {
        NumPadGrid(
            onDigit: { number in
                if numberEntryType == 1 {
                    if numbers[0] == 0 {
                        numbers.append(number)
                        numbers.remove(at: 0)
                    } else {
                        numbers.append(number)
                    }
                } else {
                    if number == 0 && numbers1.isEmpty { return }
                    if numbers1.contains(".") {
                        if numbers1.count - numbers1.firstIndex(of: ".")! < 3 {
                            numbers1.append(String(number))
                        }
                    } else {
                        numbers1.append(String(number))
                    }
                }
            },
            onLeftKey: {
                if numberEntryType == 1 {
                    if numbers.count == 3 {
                        numbers.remove(at: numbers.count - 1)
                        numbers.insert(0, at: 0)
                    } else {
                        numbers.remove(at: numbers.count - 1)
                    }
                } else {
                    if numbers1.isEmpty {
                        numbers1.append("0")
                        numbers1.append(".")
                    } else if !numbers1.contains(".") {
                        numbers1.append(".")
                    }
                }
            },
            onSubmit: submit,
            leftKeyLabel: { size in
                if numberEntryType == 1 {
                    Image("tag-cross")
                        .resizable()
                        .frame(width: 32, height: 32)
                        .frame(width: size.width * 0.3, height: size.height * 0.22)
                        .background(Color.DarkBackground)
                        .foregroundStyle(Color.LightIcon)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                } else {
                    Text(".")
                        .scaledFont(34, weight: .regular, design: .rounded)
                        .frame(width: size.width * 0.3, height: size.height * 0.22)
                        .background(Color.SecondaryBackground)
                        .foregroundStyle(Color.PrimaryText)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .opacity(numbers1.contains(".") ? 0.6 : 1)
                }
            },
            digitsDisabled: numberArrayCount == 9,
            leftKeyDisabled: numberEntryType == 2 && numbers1.contains("."),
            submitBounceValue: numberArrayCount != 0
        )
    }

    @ViewBuilder
    private func deleteButton() -> some View {
        Button {
            if !numbers1.isEmpty {
                if numbers1.count == 2 && numbers1[0] == "0" && numbers1[1] == "." {
                    numbers1.removeAll()
                } else {
                    numbers1.removeLast()
                }
            }

        } label: {
            Image(systemName: "delete.left.fill")
                .scaledFont(16, weight: .semibold)
                .foregroundStyle(Color.SubtitleText)
                .padding(7)
                .background(Color.SecondaryBackground, in: Circle())
                .contentShape(Circle())
        }
        .disabled(numbers1.isEmpty)
    }

    @ViewBuilder
    static func DeleteButton(numbers1: Binding<[String]>) -> some View {
        Button {
            if !numbers1.wrappedValue.isEmpty {
                if numbers1.wrappedValue.count == 2 && numbers1.wrappedValue[0] == "0" && numbers1.wrappedValue[1] == "." {
                    numbers1.wrappedValue.removeAll()
                } else {
                    numbers1.wrappedValue.removeLast()
                }
            }

        } label: {
            Image(systemName: "delete.left.fill")
                .scaledFont(16, weight: .semibold)
                .foregroundStyle(Color.SubtitleText)
                .padding(7)
                .background(Color.SecondaryBackground, in: Circle())
                .contentShape(Circle())
        }
        .disabled(numbers1.wrappedValue.isEmpty)
    }
}

private struct TemplateTransactionDeleteSheet: View {
    @Binding var isPresented: Bool
    @Binding var toDelete: TemplateTransaction?
    let bottomEdge: Double
    let systemColorScheme: ColorScheme
    let onDelete: () -> Void

    @State private var offset: CGFloat = 0

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.clear
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .contentShape(Rectangle())
                .onTapGesture {
                    isPresented = false
                    toDelete = nil
                }

            VStack(alignment: .leading, spacing: 1.5) {
                Text("Delete Expense?")
                    .scaledFont(20, weight: .medium, design: .rounded)
                    .foregroundStyle(Color.PrimaryText)

                Text("This action cannot be undone.")
                    .scaledFont(16, weight: .medium, design: .rounded)
                    .foregroundStyle(Color.SubtitleText)
                    .padding(.bottom, 15)

                Button {
                    onDelete()

                } label: {
                    Text("Delete")
                        .scaledFont(20, weight: .semibold, design: .rounded)
                        .foregroundStyle(.white)
                        .frame(height: 45)
                        .frame(maxWidth: .infinity)
                        .background(Color.AlertRed, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                }
                .padding(.bottom, 8)

                Button {
                    withAnimation(.easeOut(duration: 0.7)) {
                        isPresented = false
                        toDelete = nil
                    }

                } label: {
                    Text("Cancel")
                        .scaledFont(20, weight: .semibold, design: .rounded)
                        .foregroundStyle(Color.PrimaryText.opacity(0.9))
                        .frame(height: 45)
                        .frame(maxWidth: .infinity)
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
                            isPresented = false
                            toDelete = nil
                        } else {
                            withAnimation {
                                offset = 0
                            }
                        }
                    }
            )
            .padding(.horizontal, 17)
            .padding(.bottom, bottomEdge == 0 ? 12 : bottomEdge - 3)
        }
        .ignoresSafeArea()
        .background(BackgroundBlurView())
    }
}
