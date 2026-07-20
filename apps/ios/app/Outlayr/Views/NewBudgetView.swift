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
    @State private var showingCategorySheet = false

    // name
    @State private var name = ""

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

    private var trimmedName: String? {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        return trimmed.isEmpty ? nil : trimmed
    }

    private var defaultName: String {
        if let selectedCategory { return selectedCategory.wrappedName }
        return categoryBudget ? String(localized: "Budget name") : String(localized: "Overall Budget")
    }

    private var previewName: String {
        if let trimmedName { return trimmedName }
        if let selectedCategory { return selectedCategory.wrappedName }
        return categoryBudget ? String(localized: "Pick a category") : String(localized: "Overall Budget")
    }

    private var previewIcon: CategoryIcon {
        selectedCategory?.wrappedIcon ?? CategoryIconCatalog.fallback(income: !categoryBudget)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if step == 1 {
                    whatAndWhenContent

                    continueButton
                        .padding(20)
                } else {
                    amountStep
                        .padding(.horizontal, 20)
                        .padding(.top, 16)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
            .background(Color.PrimaryBackground)
            .overlay(alignment: .top) { toast }
            .navigationBarTitleDisplayMode(.inline)
            .tint(Color.PrimaryText)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        if step > 1 {
                            withAnimation(.interactiveSpring(response: 0.5, dampingFraction: 0.85)) { step -= 1 }
                        } else {
                            dismiss()
                        }
                    } label: {
                        Image(systemName: step > 1 ? "chevron.left" : "xmark")
                    }
                    .contentTransition(.symbolEffect(.replace.downUp.wholeSymbol))
                }

                ToolbarItem(placement: .principal) {
                    Text(titleText)
                        .font(.system(.headline, design: .rounded).weight(.semibold))
                        .foregroundStyle(Color.PrimaryText)
                }

                progressDotsItem
            }
            .animation(.easeOut(duration: 0.2), value: showToast)
            .onChange(of: showToast) { _, newValue in
                if newValue {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                        showToast = false
                    }
                }
            }
            .sheet(isPresented: $showingCategoryView) {
                NewCategoryAlert(income: Binding.constant(false), budgetMode: true)
            }
            .sheet(isPresented: $showingCategorySheet) {
                BudgetCategoryPickerSheet(selectedCategory: $selectedCategory)
            }
            .onAppear(perform: restoreEditState)
        }
    }

    private var progressDots: some View {
        HStack(spacing: 6) {
            ForEach(1 ... 2, id: \.self) { index in
                Capsule()
                    .fill(index <= step ? Color.PrimaryText : Color.SecondaryBackground)
                    .frame(width: index <= step ? 20 : 12, height: 5)
            }
        }
        .animation(.easeInOut, value: step)
    }

    @ToolbarContentBuilder
    private var progressDotsItem: some ToolbarContent {
        if #available(iOS 26.0, *) {
            ToolbarItem(placement: .topBarTrailing) { progressDots }
                .sharedBackgroundVisibility(.hidden)
        } else {
            ToolbarItem(placement: .topBarTrailing) { progressDots }
        }
    }

    // MARK: - Step 1: what & when

    private var whatAndWhenContent: some View {
        GeometryReader { proxy in
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 26) {
                    if showTypePicker {
                        section("Budget type") {
                            SegmentedSelector(selection: $categoryBudget, options: [
                                (value: false, label: "Overall"),
                                (value: true, label: "Category")
                            ])
                        }
                    }

                    if showCategoryPicker {
                        section("Category") {
                            categoryChips
                        }
                    }

                    section("Name") {
                        nameField
                    }

                    section("Time frame") {
                        SegmentedSelector(
                            selection: $budgetTimeFrame,
                            options: BudgetTimeFrame.allCases.map { (value: $0, label: LocalizedStringKey($0.rawValue)) }
                        )
                    }

                    if budgetTimeFrame != .day {
                        section(budgetTimeFrame == .year ? "Start date" : "Starts on") {
                            startDaySelector
                        }
                    }

                    Spacer(minLength: 24)

                    livePreview
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)
                .padding(.bottom, 20)
                .frame(minHeight: proxy.size.height, alignment: .top)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var previewPeriodText: String {
        switch budgetTimeFrame {
        case .day: return String(localized: "Resets daily")
        case .week: return String(localized: "Resets weekly")
        case .month: return String(localized: "Resets monthly")
        case .year: return String(localized: "Resets yearly")
        }
    }

    private var livePreview: some View {
        let color = selectedCategory.map { Color(hex: $0.wrappedColour) } ?? Color.PrimaryText

        return VStack(spacing: 12) {
            ZStack {
                DonutSemicircle(percent: 1, cornerRadius: 6, width: 18)
                    .fill(Color.SubtitleText.opacity(0.12))
                    .frame(width: 140, height: 70)

                DonutSemicircle(percent: 0.66, cornerRadius: 6, width: 18)
                    .fill(color.opacity(0.85))
                    .frame(width: 140, height: 70)

                CategoryIconGlyph(icon: previewIcon, size: 24)
                    .foregroundStyle(color)
                    .offset(y: 6)
            }
            .animation(.snappy(duration: 0.3), value: selectedCategory)

            VStack(spacing: 2) {
                Text(previewName)
                    .font(.system(.headline, design: .rounded).weight(.semibold))
                    .foregroundStyle(Color.PrimaryText)
                    .lineLimit(1)

                Text("\(previewPeriodText) · set your limit next")
                    .font(.system(.footnote, design: .rounded).weight(.medium))
                    .foregroundStyle(Color.SubtitleText)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(Color.SubtitleText.opacity(0.05))
                .shadow(color: Color.PrimaryText.opacity(0.05), radius: 12, y: 5)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(Color.SubtitleText.opacity(0.12), lineWidth: 1)
        )
    }

    private var nameField: some View {
        TextField(defaultName, text: $name)
            .font(.system(.body, design: .rounded).weight(.medium))
            .foregroundStyle(Color.PrimaryText)
            .tint(Color.PrimaryText)
            .submitLabel(.done)
            .padding(.horizontal, 14)
            .padding(.vertical, 13)
            .background(Color.SecondaryBackground, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func section<Content: View>(_ title: LocalizedStringKey, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.system(.subheadline, design: .rounded).weight(.semibold))
                .foregroundStyle(Color.SubtitleText)

            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var categoryChips: some View {
        Group {
            if categories.isEmpty {
                HStack(spacing: 10) {
                    newCategoryChip
                    Text("Create a category to link it.")
                        .font(.system(.footnote, design: .rounded).weight(.medium))
                        .foregroundStyle(Color.SubtitleText)
                }
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        newCategoryChip
                        if categories.count > 8 {
                            browseChip
                        }
                        ForEach(categories) { category in
                            categoryChip(category)
                        }
                    }
                    .padding(.vertical, 2)
                }
                .contentMargins(.horizontal, 20, for: .scrollContent)
                .padding(.horizontal, -20)
            }
        }
    }

    private func categoryChip(_ category: Category) -> some View {
        let selected = selectedCategory == category
        let color = Color(hex: category.wrappedColour)

        return Button {
            withAnimation(.snappy(duration: 0.2)) {
                selectedCategory = selected ? nil : category
            }
        } label: {
            HStack(spacing: 5) {
                CategoryIconGlyph(symbol: category.displaySymbol)
                Text(category.wrappedName)
                    .font(.system(.subheadline, design: .rounded).weight(.semibold))
            }
            .padding(.horizontal, 13)
            .padding(.vertical, 9)
            .foregroundStyle(selected ? color : Color.PrimaryText)
            .background(selected ? color.opacity(0.3) : Color.clear, in: Capsule())
            .overlay {
                if !selected {
                    Capsule().stroke(Color.Outline, lineWidth: 1.5)
                }
            }
        }
        .buttonStyle(BouncyButton(duration: 0.2, scale: 0.9))
    }

    private var newCategoryChip: some View {
        Button {
            showingCategoryView = true
        } label: {
            HStack(spacing: 4) {
                Image(systemName: "plus")
                Text("New")
            }
            .font(.system(.subheadline, design: .rounded).weight(.semibold))
            .foregroundStyle(Color.SubtitleText)
            .padding(.horizontal, 13)
            .padding(.vertical, 9)
            .overlay {
                Capsule().stroke(Color.Outline, lineWidth: 1.5)
            }
        }
        .buttonStyle(BouncyButton(duration: 0.2, scale: 0.9))
    }

    private var browseChip: some View {
        Button {
            showingCategorySheet = true
        } label: {
            HStack(spacing: 4) {
                Image(systemName: "magnifyingglass")
                Text("All")
            }
            .font(.system(.subheadline, design: .rounded).weight(.semibold))
            .foregroundStyle(Color.SubtitleText)
            .padding(.horizontal, 13)
            .padding(.vertical, 9)
            .overlay {
                Capsule().stroke(Color.Outline, lineWidth: 1.5)
            }
        }
        .buttonStyle(BouncyButton(duration: 0.2, scale: 0.9))
    }

    @ViewBuilder
    private var startDaySelector: some View {
        switch budgetTimeFrame {
        case .day:
            EmptyView()
        case .week:
            let symbols = Calendar.current.veryShortStandaloneWeekdaySymbols
            HStack(spacing: 5) {
                ForEach(Array(symbols.enumerated()), id: \.offset) { index, symbol in
                    let value = index + 1
                    dayCircle(label: symbol, selected: chosenDayWeek == value) {
                        chosenDayWeek = value
                    }
                }
            }
        case .month:
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(1 ..< 29, id: \.self) { day in
                        dayCircle(label: "\(day)", selected: chosenDayMonth == day) {
                            chosenDayMonth = day
                        }
                    }
                }
                .padding(.vertical, 2)
            }
        case .year:
            DatePicker("", selection: $chosenDayYear, in: oneYearAgo ... Date.now, displayedComponents: .date)
                .labelsHidden()
                .datePickerStyle(.compact)
                .tint(Color.PrimaryText)
        }
    }

    private func dayCircle(label: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Text(label)
            .font(.system(.subheadline, design: .rounded).weight(.semibold))
            .foregroundStyle(selected ? Color.PrimaryBackground : Color.PrimaryText)
            .frame(width: 40, height: 40)
            .background(Circle().fill(selected ? Color.PrimaryText : Color.SecondaryBackground))
            .contentShape(Circle())
            .onTapGesture {
                withAnimation(.snappy(duration: 0.2)) { action() }
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
            name = unwrappedEditedBudget.name ?? ""
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
            name = unwrappedEditedMainBudget.name ?? ""
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
            unwrappedEditedBudget.name = trimmedName

            dataController.save()
            dismiss()
            return
        }

        if let unwrappedEditedMainBudget = toEditMainBudget {
            unwrappedEditedMainBudget.startDate = startDate
            unwrappedEditedMainBudget.amount = price
            unwrappedEditedMainBudget.type = Int16(budgetType)
            unwrappedEditedMainBudget.name = trimmedName

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
            newBudget.name = trimmedName
        } else {
            let newBudget = MainBudget(context: moc)
            newBudget.startDate = startDate
            newBudget.amount = price
            newBudget.type = Int16(budgetType)
            newBudget.name = trimmedName
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

private struct BudgetCategoryPickerSheet: View {
    @Binding var selectedCategory: Category?
    @Environment(\.dismiss) private var dismiss
    @FetchRequest private var categories: FetchedResults<Category>
    @State private var search = ""

    private let columns = [
        GridItem(.flexible(), spacing: 10),
        GridItem(.flexible(), spacing: 10)
    ]

    init(selectedCategory: Binding<Category?>) {
        _selectedCategory = selectedCategory
        let budgetPredicate = NSPredicate(format: "%K == nil", #keyPath(Category.budget))
        let incomePredicate = NSPredicate(format: "income = %d", false)
        _categories = FetchRequest(
            sortDescriptors: [SortDescriptor(\.order)],
            predicate: NSCompoundPredicate(type: .and, subpredicates: [budgetPredicate, incomePredicate])
        )
    }

    private var isSearching: Bool {
        !search.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private var filtered: [Category] {
        let query = search.trimmingCharacters(in: .whitespaces).lowercased()
        guard !query.isEmpty else { return Array(categories) }
        return categories.filter { $0.wrappedName.lowercased().contains(query) }
    }

    private var recentCategories: [Category] {
        Array(categories)
            .filter { $0.transactionCount > 0 }
            .sorted { ($0.allTransactions.last?.wrappedDate ?? .distantPast) > ($1.allTransactions.last?.wrappedDate ?? .distantPast) }
            .prefix(6)
            .map { $0 }
    }

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                LazyVStack(alignment: .leading, spacing: 22, pinnedViews: []) {
                    if !isSearching && !recentCategories.isEmpty {
                        gridSection("Recent", recentCategories)
                    }

                    if filtered.isEmpty {
                        emptyResults
                    } else {
                        gridSection(isSearching ? "Results" : "All Categories", filtered)
                    }
                }
                .padding(20)
            }
            .background(Color.PrimaryBackground)
            .navigationTitle("Choose Category")
            .navigationBarTitleDisplayMode(.inline)
            .tint(Color.PrimaryText)
            .searchable(text: $search, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search categories")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private func gridSection(_ title: LocalizedStringKey, _ items: [Category]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.system(.subheadline, design: .rounded).weight(.semibold))
                .foregroundStyle(Color.SubtitleText)

            LazyVGrid(columns: columns, spacing: 10) {
                ForEach(items, id: \.self) { category in
                    tile(category)
                }
            }
        }
    }

    private func tile(_ category: Category) -> some View {
        let colour = Color(hex: category.wrappedColour)
        let selected = selectedCategory == category

        return Button {
            selectedCategory = category
            dismiss()
        } label: {
            HStack(spacing: 7) {
                CategoryIconGlyph(symbol: category.displaySymbol)
                    .foregroundStyle(colour)
                Text(category.wrappedName)
                    .font(.system(.body, design: .rounded).weight(.semibold))
                    .lineLimit(1)
                Spacer(minLength: 0)
                if selected {
                    Image(systemName: "checkmark")
                        .font(.system(.footnote, design: .rounded).weight(.bold))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 12)
            .padding(.vertical, 12)
            .foregroundStyle(colour)
            .background(colour.opacity(0.3), in: RoundedRectangle(cornerRadius: 13, style: .continuous))
            .overlay {
                if selected {
                    RoundedRectangle(cornerRadius: 13, style: .continuous)
                        .strokeBorder(colour, lineWidth: 2)
                }
            }
        }
        .buttonStyle(BouncyButton(duration: 0.2, scale: 0.94))
    }

    private var emptyResults: some View {
        VStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(.title, design: .rounded))
                .foregroundStyle(Color.SubtitleText.opacity(0.6))
            Text("No categories found")
                .font(.system(.subheadline, design: .rounded).weight(.medium))
                .foregroundStyle(Color.SubtitleText)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 60)
    }
}

private struct SegmentedSelector<T: Hashable>: View {
    @Binding var selection: T
    let options: [(value: T, label: LocalizedStringKey)]

    @Namespace private var namespace

    var body: some View {
        HStack(spacing: 4) {
            ForEach(options.indices, id: \.self) { index in
                let option = options[index]
                let selected = option.value == selection

                Text(option.label)
                    .font(.system(.subheadline, design: .rounded).weight(.semibold))
                    .foregroundStyle(selected ? Color.PrimaryBackground : Color.PrimaryText)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background {
                        if selected {
                            Capsule()
                                .fill(Color.PrimaryText)
                                .matchedGeometryEffect(id: "segmentedSelection", in: namespace)
                        }
                    }
                    .contentShape(Capsule())
                    .onTapGesture {
                        withAnimation(.snappy(duration: 0.25)) { selection = option.value }
                    }
            }
        }
        .padding(4)
        .background(Color.SecondaryBackground, in: Capsule())
    }
}
