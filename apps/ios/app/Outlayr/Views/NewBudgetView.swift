//
//  NewBudgetView.swift
//  Outlayr
//
//  Created by Rafael Soh on 15/7/23.
//

import CoreData
import SwiftUI

struct InstructionHeadings {
    let title: String
    let subtitle: String
}

struct BrandNewBudgetView: View {
    @FetchRequest private var categories: FetchedResults<Category>

    @AppStorage("firstWeekday", store: AppIdentifiers.sharedDefaults) var firstWeekday: Int = 1
    @AppStorage("firstDayOfMonth", store: AppIdentifiers.sharedDefaults) var firstDayOfMonth: Int = 1

    @Environment(\.managedObjectContext) var moc
    @Environment(DataController.self) private var dataController

    @Environment(\.dismiss) var dismiss

    @State private var step = 1

    @State private var showToast = false
    @State private var toastMessage = "Missing Amount"

    // budget type
    @State var categoryBudget = false
    var overallBudgetCreated: Bool

    // category
    @State var selectedCategory: Category?
    @State private var showingCategoryView = false

    // period
    @State var budgetTimeFrame = BudgetTimeFrame.week
    @State var chosenDayWeek = 1
    @State var chosenDayMonth = 1
    @State var chosenDayYear = Date.now

    let weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

    // amount
    @AppStorage("numberEntryType", store: AppIdentifiers.sharedDefaults) var numberEntryType: Int = 1
    @State private var price: Double = 0
    @State private var category: Category?
    @State var isEditingDecimal = false
    @State var decimalValuesAssigned: AssignedDecimal = .none

    @AppStorage("currency", store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency)!
    }

    // editMode
    let toEditBudget: Budget?
    let toEditMainBudget: MainBudget?
    var editMode: Bool {
        toEditBudget != nil || toEditMainBudget != nil
    }

    var timeFrameString: String {
        switch budgetTimeFrame {
        case .day: return String(localized: "day")
        case .week: return String(localized: "weekNewBudget")
        case .month: return String(localized: "monthNewBudget")
        case .year: return String(localized: "yearNewBudget")
        }
    }

    var oneYearAgo: Date {
        return Calendar.current.date(byAdding: .year, value: -1, to: Date.now)!
    }

    var amountPerDayString: String {
        let numberFormatter = NumberFormatter()
        numberFormatter.numberStyle = .currency
        numberFormatter.currencyCode = currency

        let average: Double
        if budgetTimeFrame == .week {
            average = price / 7
        } else if budgetTimeFrame == .month {
            average = price / 30
        } else {
            average = price / 365
        }

        numberFormatter.maximumFractionDigits = 0
        return "~" + (numberFormatter.string(from: NSNumber(value: average)) ?? "$0") + " /day"
    }

    private var showTypePicker: Bool { !editMode && !overallBudgetCreated }
    private var showCategoryPicker: Bool { !editMode && categoryBudget }
    private var canContinue: Bool { !(showCategoryPicker && selectedCategory == nil) }

    private var titleText: String {
        if step == 2 { return String(localized: "Set amount") }
        return editMode ? String(localized: "Edit budget") : String(localized: "New budget")
    }

    private var subtitleText: String {
        step == 2
            ? String(localized: "Try to stay under this limit — you can change it anytime.")
            : String(localized: "Choose what to track and when it resets.")
    }

    var body: some View {
        VStack(spacing: 0) {
            header
                .padding(.horizontal, 20)
                .padding(.top, 20)

            titleBlock
                .padding(.horizontal, 20)
                .padding(.top, 18)
                .padding(.bottom, step == 1 ? 4 : 18)

            if step == 1 {
                whatAndWhenForm

                continueButton
                    .padding(20)
            } else {
                amountStep
                    .padding(.horizontal, 20)
                    .padding(.top, 4)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .background(Color.PrimaryBackground)
        .overlay(alignment: .top) { toast }
        .animation(.easeOut(duration: 0.2), value: showToast)
        .onChange(of: showToast) { _, newValue in
            if newValue {
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                    showToast = false
                }
            }
        }
        .sheet(isPresented: $showingCategoryView) {
            NewCategoryAlert(income: Binding.constant(false), bottomSpacers: true, budgetMode: true)
        }
        .onAppear(perform: restoreEditState)
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            Button {
                if step > 1 {
                    withAnimation(.interactiveSpring(response: 0.5, dampingFraction: 0.85)) { step -= 1 }
                } else {
                    dismiss()
                }
            } label: {
                Image(systemName: step > 1 ? "chevron.left" : "xmark")
                    .font(.system(.callout, design: .rounded).weight(.semibold))
                    .foregroundStyle(Color.SubtitleText)
                    .padding(8)
                    .background(Color.SecondaryBackground, in: Circle())
            }
            .contentTransition(.symbolEffect(.replace.downUp.wholeSymbol))

            Spacer()

            HStack(spacing: 6) {
                ForEach(1 ... 2, id: \.self) { index in
                    Capsule()
                        .fill(index <= step ? Color.PrimaryText : Color.SecondaryBackground)
                        .frame(width: index <= step ? 20 : 12, height: 5)
                }
            }
        }
        .animation(.easeInOut, value: step)
    }

    private var titleBlock: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(titleText)
                .font(.system(.title2, design: .rounded).weight(.semibold))
                .foregroundStyle(Color.PrimaryText)

            Text(subtitleText)
                .font(.system(.body, design: .rounded).weight(.medium))
                .foregroundStyle(Color.SubtitleText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Step 1: what & when

    private var whatAndWhenForm: some View {
        Form {
            if showTypePicker {
                Section {
                    Picker("Budget type", selection: $categoryBudget) {
                        Text("Overall").tag(false)
                        Text("Category").tag(true)
                    }
                    .pickerStyle(.segmented)
                } footer: {
                    Text("An overall budget tracks every expense; a category budget tracks a single category.")
                }
            }

            if showCategoryPicker {
                Section("Category") {
                    if categories.isEmpty {
                        Text("No remaining categories")
                            .foregroundStyle(Color.SubtitleText)
                    } else {
                        Picker("Category", selection: $selectedCategory) {
                            Text("Select…").tag(Category?.none)
                            ForEach(categories) { category in
                                Text("\(category.wrappedEmoji)  \(category.wrappedName)")
                                    .tag(Category?.some(category))
                            }
                        }
                        .pickerStyle(.menu)
                    }

                    Button {
                        showingCategoryView = true
                    } label: {
                        Label("New Category", systemImage: "plus")
                    }
                }
            }

            Section {
                Picker("Time frame", selection: $budgetTimeFrame) {
                    ForEach(BudgetTimeFrame.allCases, id: \.self) { time in
                        Text(LocalizedStringKey(time.rawValue)).tag(time)
                    }
                }
                .pickerStyle(.menu)

                startDayField
            } header: {
                Text("Period")
            } footer: {
                Text("Your budget refreshes each \(timeFrameString).")
            }
        }
        .scrollContentBackground(.hidden)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private var startDayField: some View {
        switch budgetTimeFrame {
        case .day:
            EmptyView()
        case .week:
            Picker("Starts on", selection: $chosenDayWeek) {
                ForEach(Array(weekdays.enumerated()), id: \.offset) { index, day in
                    Text(LocalizedStringKey(day)).tag(index + 1)
                }
            }
            .pickerStyle(.menu)
        case .month:
            Picker("Starts on", selection: $chosenDayMonth) {
                ForEach(1 ..< 29, id: \.self) { day in
                    Text(day == 1 ? String(localized: "Start of month") : "\(getOrdinal(day)) of month").tag(day)
                }
            }
            .pickerStyle(.menu)
        case .year:
            DatePicker("Start date", selection: $chosenDayYear, in: oneYearAgo ... Date.now, displayedComponents: .date)
        }
    }

    private var continueButton: some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            withAnimation(.interactiveSpring(response: 0.5, dampingFraction: 0.85)) { step = 2 }
        } label: {
            Text("Continue")
                .font(.system(.title3, design: .rounded).weight(.semibold))
                .padding(.vertical, 14)
                .frame(maxWidth: .infinity)
                .foregroundStyle(canContinue ? Color.PrimaryBackground : Color.SubtitleText)
                .background(canContinue ? Color.PrimaryText : Color.SecondaryBackground, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(BouncyButton(duration: 0.2, scale: 0.95))
        .disabled(!canContinue)
    }

    // MARK: - Step 2: amount

    private var amountStep: some View {
        VStack(spacing: 10) {
            NumberPadTextView(
                price: $price,
                isEditingDecimal: $isEditingDecimal,
                decimalValuesAssigned: $decimalValuesAssigned
            )

            if budgetTimeFrame != .day && price > 0 {
                Text(amountPerDayString)
                    .font(.system(.subheadline, design: .rounded).weight(.semibold))
                    .foregroundStyle(Color.SubtitleText)
                    .padding(4)
                    .padding(.horizontal, 7)
                    .background(Color.SecondaryBackground, in: Capsule())
            }

            Spacer()

            NumberPad(
                price: $price,
                category: $category,
                isEditingDecimal: $isEditingDecimal,
                decimalValuesAssigned: $decimalValuesAssigned
            ) {
                submit()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Toast

    @ViewBuilder
    private var toast: some View {
        if showToast {
            HStack(spacing: 6.5) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(.subheadline, design: .rounded).weight(.semibold))
                    .foregroundStyle(Color.AlertRed)

                Text(toastMessage)
                    .font(.system(.callout, design: .rounded).weight(.semibold))
                    .foregroundStyle(Color.AlertRed)
            }
            .padding(8)
            .background(Color.AlertRed.opacity(0.23), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
            .transition(.opacity.combined(with: .move(edge: .top)))
            .padding(.top, 8)
        }
    }

    // MARK: - Logic

    private func restoreEditState() {
        if let unwrappedEditedBudget = toEditBudget {
            selectedCategory = unwrappedEditedBudget.category
            switch unwrappedEditedBudget.type {
            case 1:
                budgetTimeFrame = .day
            case 2:
                budgetTimeFrame = .week
                chosenDayWeek = Calendar.current.dateComponents([.weekday], from: unwrappedEditedBudget.startDate!).weekday!
            case 3:
                budgetTimeFrame = .month
                chosenDayMonth = Calendar.current.dateComponents([.day], from: unwrappedEditedBudget.startDate!).day!
            case 4:
                budgetTimeFrame = .year
                chosenDayYear = unwrappedEditedBudget.startDate!
            default:
                budgetTimeFrame = .week
            }

            price = unwrappedEditedBudget.amount

            if unwrappedEditedBudget.amount.truncatingRemainder(dividingBy: 1) > 0 && numberEntryType == 2 {
                isEditingDecimal = true
                decimalValuesAssigned = .second
            }
        } else if let unwrappedEditedMainBudget = toEditMainBudget {
            switch unwrappedEditedMainBudget.type {
            case 1:
                budgetTimeFrame = .day
            case 2:
                budgetTimeFrame = .week
                chosenDayWeek = Calendar.current.dateComponents([.weekday], from: unwrappedEditedMainBudget.startDate!).weekday!
            case 3:
                budgetTimeFrame = .month
                chosenDayMonth = Calendar.current.dateComponents([.day], from: unwrappedEditedMainBudget.startDate!).day!
            case 4:
                budgetTimeFrame = .year
                chosenDayYear = unwrappedEditedMainBudget.startDate!
            default:
                budgetTimeFrame = .week
            }

            price = unwrappedEditedMainBudget.amount

            if unwrappedEditedMainBudget.amount.truncatingRemainder(dividingBy: 1) > 0 && numberEntryType == 2 {
                isEditingDecimal = true
                decimalValuesAssigned = .second
            }
        } else {
            chosenDayWeek = firstWeekday
            chosenDayMonth = firstDayOfMonth
        }
    }

    func submit() {
        if price == 0 {
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            showToast = true
            toastMessage = "Missing Amount"
            return
        }

        UIImpactFeedbackGenerator(style: .light).impactOccurred()

        let budgetType = getBudgetTypeInteger(budgetTimeFrame)
        let today = Calendar.current.startOfDay(for: Date.now)
        var startDate: Date

        switch budgetTimeFrame {
        case .day:
            startDate = today
        case .week:
            var calendar = Calendar(identifier: .gregorian)
            calendar.firstWeekday = 1
            calendar.minimumDaysInFirstWeek = 4

            let dateComponents = calendar.dateComponents([.weekOfYear, .yearForWeekOfYear], from: today)

            let sunday = calendar.date(from: dateComponents)!

            let holdingDate = calendar.date(byAdding: .day, value: chosenDayWeek - 1, to: sunday)!

            if holdingDate > today {
                let newHoldingDate = calendar.date(byAdding: .day, value: -7, to: holdingDate)!
                startDate = newHoldingDate
            } else {
                startDate = holdingDate
            }
        case .month:
            let calendar = Calendar.current

            let dateComponents = calendar.dateComponents([.month, .year], from: today)

            let startOfMonth = calendar.date(from: dateComponents)!

            let holdingDate = calendar.date(byAdding: .day, value: chosenDayMonth - 1, to: startOfMonth)!

            if holdingDate > today {
                let newHoldingDate = calendar.date(byAdding: .month, value: -1, to: holdingDate)!
                startDate = newHoldingDate
            } else {
                startDate = holdingDate
            }
        case .year:
            startDate = Calendar.current.startOfDay(for: chosenDayYear)
        }

        if let unwrappedEditedBudget = toEditBudget {
            unwrappedEditedBudget.category = selectedCategory
            unwrappedEditedBudget.startDate = startDate
            unwrappedEditedBudget.amount = price
            unwrappedEditedBudget.type = Int16(budgetType)

            dataController.save()
            dismiss()
            return
        }

        if let unwrappedEditedMainBudget = toEditMainBudget {
            unwrappedEditedMainBudget.startDate = startDate
            unwrappedEditedMainBudget.amount = price
            unwrappedEditedMainBudget.type = Int16(budgetType)

            dataController.save()
            dismiss()
            return
        }

        if categoryBudget {
            let newBudget = Budget(context: moc)

            if let unwrappedCategory = selectedCategory {
                newBudget.category = unwrappedCategory
            }

            newBudget.startDate = startDate
            newBudget.amount = price
            newBudget.dateCreated = Date.now
            newBudget.type = Int16(budgetType)
            newBudget.id = UUID()
        } else {
            let newBudget = MainBudget(context: moc)
            newBudget.startDate = startDate
            newBudget.amount = price
            newBudget.type = Int16(budgetType)
        }

        dataController.save()
        dismiss()
    }

    func getOrdinal(_ number: Int) -> String {
        if number == 1 {
            return String(localized: "Start")
        }

        let formatter = NumberFormatter()
        formatter.numberStyle = .ordinal
        return formatter.string(from: number as NSNumber)!.replacingOccurrences(of: ".", with: "")
    }

    func getBudgetTypeInteger(_ budget: BudgetTimeFrame) -> Int {
        switch budget {
        case .day: return 1
        case .week: return 2
        case .month: return 3
        case .year: return 4
        }
    }

    init(overallBudgetCreated: Bool, toEditBudget: Budget? = nil, toEditMainBudget: MainBudget? = nil) {
        if toEditBudget != nil {
            self.overallBudgetCreated = overallBudgetCreated
            _categoryBudget = State(initialValue: true)
        } else if toEditMainBudget != nil {
            self.overallBudgetCreated = overallBudgetCreated
            _categoryBudget = State(initialValue: false)
        } else if overallBudgetCreated {
            self.overallBudgetCreated = true
            _categoryBudget = State(initialValue: true)
        } else {
            self.overallBudgetCreated = false
        }

        self.toEditBudget = toEditBudget
        self.toEditMainBudget = toEditMainBudget

        let budgetPredicate = NSPredicate(format: "%K == nil", #keyPath(Category.budget))
        let incomePredicate = NSPredicate(format: "income = %d", false)
        let andPredicate = NSCompoundPredicate(type: .and, subpredicates: [budgetPredicate, incomePredicate])

        _categories = FetchRequest<Category>(sortDescriptors: [
            SortDescriptor(\.order)
        ], predicate: andPredicate)
    }
}
