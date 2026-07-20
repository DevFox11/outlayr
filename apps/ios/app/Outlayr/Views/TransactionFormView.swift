//
//  TransactionFormView.swift
//  Outlayr
//
//  The native add/edit transaction form. A grouped surface under an ambient
//  identity curtain, with a tappable hero (opens the identity picker), a
//  One-time | Subscription segmented control that morphs the schedule rows, and
//  grouped rows that open the glass amount sheet and the hierarchical category
//  sheet. Replaces the numpad-in-page editor that used to live in
//  TransactionView; `TransactionView` is now a thin shell forwarding here so the
//  existing call sites (`init(toEdit:)`, `init(category:)`) don't churn. All the
//  save rules live in `TransactionFormDraft` so they stay unit-testable.
//

import CoreData
import SwiftUI

struct TransactionFormView: View {
    let toEdit: Transaction?
    private let presetCategory: Category?

    @Environment(\.managedObjectContext) private var moc
    @Environment(DataController.self) private var dataController
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme

    @AppStorage(CurrencyPreference.storageKey, store: AppIdentifiers.sharedDefaults)
    private var globalCurrency: String = CurrencyPreference.resolve()

    @State private var draft = TransactionFormDraft()
    @State private var category: Category?

    @State private var showingIdentityPicker = false
    @State private var showingAmountSheet = false
    @State private var showingCategorySheet = false
    @State private var showingCustomSchedule = false
    @State private var activeDatePicker: DatePickerTarget?

    @State private var showToast = false
    @State private var categoryShake = false
    @State private var categoryErrored = false
    @State private var deleteConfirm = false
    @State private var hasSeeded = false

    private let nameLimit = 50
    /// The form dims and stops responding behind the identity picker sheet,
    /// mirroring `CategorySheetSurface`.
    private let formBlurRadius: CGFloat = 8
    /// Matches the amount sheet's resting height so the numpad detent lines up.
    private let amountSheetHeight: CGFloat = 560

    enum DatePickerTarget: Identifiable {
        case date, time, firstPayment, endDate
        var id: Int { hashValue }
    }

    init(toEdit: Transaction? = nil, category: Category? = nil) {
        self.toEdit = toEdit
        presetCategory = category
    }

    private var isEditing: Bool { toEdit != nil }
    private var effectiveCurrency: String { draft.currency ?? globalCurrency }

    private var tint: Color {
        if let hex = draft.identity.effectiveColour, !hex.isEmpty { return Color(hex: hex) }
        if draft.income { return Color.IncomeGreen }
        if let category { return Color(hex: category.wrappedColour) }
        return Color.PrimaryText
    }

    /// Curtain hues: a photo leads with its extracted colour, an emoji blends its
    /// own dominant hues, an icon glows in the effective tint alone — padded to
    /// the three the mesh needs. Mirrors `CategorySheetSurface`.
    private var glowColors: [Color] {
        switch draft.identity.symbol {
        case .none:
            return [tint]
        case let .photo(_, colour):
            return [colour.isEmpty ? tint : Color(hex: colour)]
        case let .emoji(value):
            let derived = EmojiGlow.colors(for: value)
            return derived.isEmpty ? [tint] : derived + [tint]
        case .icon:
            return [tint]
        }
    }

    var body: some View {
        NavigationStack {
            GeometryReader { proxy in
                ZStack(alignment: .bottom) {
                    Color(.systemGroupedBackground).ignoresSafeArea()
                    curtain

                    // The hero lives OUTSIDE the blurred form so it stays sharp and
                    // can float over the identity picker, mirroring
                    // CategorySheetSurface. Only the scrolling form content blurs.
                    VStack(spacing: 0) {
                        heroHeader(in: proxy)
                            .zIndex(1)

                        formScroll
                            .blur(radius: showingIdentityPicker ? formBlurRadius : 0)
                            .allowsHitTesting(!showingIdentityPicker)
                    }

                    cta
                }
                .animation(IdentityHero.motion, value: showingIdentityPicker)
            }
            .navigationTitle(draft.isSubscription ? "Subscription" : "Transaction")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { toolbarContent }
            .animation(.easeInOut(duration: 0.25), value: draft.isSubscription)
        }
        .onAppear(perform: seed)
        .sheet(isPresented: $showingIdentityPicker) {
            TransactionIdentityPickerSheet(selection: $draft.identity, income: draft.income, tint: tint)
        }
        .sheet(isPresented: $showingAmountSheet) {
            AmountEntrySheet(amount: $draft.amount, currency: $draft.currency, income: draft.income) {
                showingAmountSheet = false
            }
            .presentationDetents([.height(amountSheetHeight), .large])
        }
        .sheet(isPresented: $showingCategorySheet) {
            TransactionCategorySheet(category: $category, income: draft.income)
        }
        .sheet(isPresented: $showingCustomSchedule) {
            CustomScheduleSheet(recurringType: $draft.recurringType, recurringCoefficient: $draft.recurringCoefficient)
        }
        .sheet(item: $activeDatePicker) { target in
            datePickerSheet(target)
        }
        .overlay(alignment: .bottom) { toast }
        .confirmationDialog("Delete transaction?", isPresented: $deleteConfirm, titleVisibility: .visible) {
            Button("Delete", role: .destructive, action: performDelete)
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This action cannot be undone.")
        }
        .onChange(of: draft.income) { category = nil }
        .onChange(of: draft.isSubscription) { _, sub in
            if sub, draft.recurringType == 0 { draft.recurringType = 3 }
        }
        .onChange(of: category) { _, cat in
            if cat != nil { withAnimation { categoryErrored = false } }
        }
    }

    private var curtain: some View {
        IdentityCurtain(
            hues: IdentityCurtain.meshHues(from: glowColors, in: colorScheme),
            revealed: !draft.identity.isEmpty
        )
        .frame(maxHeight: .infinity, alignment: .top)
        .ignoresSafeArea()
        .allowsHitTesting(false)
    }

    /// The sharp, fixed hero header. Its tile floats over the identity picker
    /// (scale + downward offset) while the picker is open; the header itself
    /// keeps its resting layout so the form below doesn't reflow.
    private func heroHeader(in proxy: GeometryProxy) -> some View {
        TransactionHero(
            selection: draft.identity,
            tint: tint,
            income: draft.income,
            showsReset: !showingIdentityPicker,
            tileScale: showingIdentityPicker ? IdentityHero.scale : 1,
            tileOffsetY: showingIdentityPicker ? openHeroOffset(in: proxy) : 0,
            onTap: { if !showingIdentityPicker { showingIdentityPicker = true } },
            onReset: { withAnimation(IdentityHero.motion) { draft.identity.clear() } }
        )
        .padding(.top, IdentityHero.topPadding)
        .padding(.bottom, IdentityHero.bottomPadding)
        .frame(maxWidth: .infinity)
    }

    private var formScroll: some View {
        ScrollView {
            VStack(spacing: 18) {
                kindPicker
                detailsGroup
                categoryGroup
                scheduleGroup
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 120)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    /// Mirrors `CategorySheetSurface.openHeroOffset`: how far the tile travels
    /// down to sit centred in the free area above the `.height(pickerHeight)`
    /// identity picker detent.
    private func openHeroOffset(in proxy: GeometryProxy) -> CGFloat {
        let restingCenter = IdentityHero.restingCenterY
        let heroHalf = CategoryIconTile.Size.large.tile * IdentityHero.scale / 2
        let free = proxy.size.height - IdentityHero.pickerHeight
        let target = max(free / 2, 16 + heroHalf)
        return target - restingCenter
    }

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .cancellationAction) {
            Button { dismiss() } label: {
                ToolbarIcon("cancel-01", size: 16)
            }
            .accessibilityLabel("Cancel")
        }
        if isEditing {
            ToolbarItem(placement: .confirmationAction) {
                Button { deleteConfirm = true } label: {
                    ToolbarIcon("delete-02", size: 18, color: .AlertRed)
                }
                .accessibilityLabel("Delete")
            }
        }
    }

    // MARK: - Kind

    private var kindPicker: some View {
        Picker("Kind", selection: $draft.isSubscription) {
            Text("One-time").tag(false)
            Text("Subscription").tag(true)
        }
        .pickerStyle(.segmented)
    }

    // MARK: - Details

    private var detailsGroup: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Name")
                    .font(.system(.body, design: .rounded))
                    .foregroundStyle(Color.PrimaryText)
                TextField("Netflix, Groceries…", text: $draft.name)
                    .font(.system(.body, design: .rounded))
                    .multilineTextAlignment(.trailing)
                    .onChange(of: draft.name) { _, value in
                        if value.count > nameLimit { draft.name = String(value.prefix(nameLimit)) }
                    }
            }
            .formRow()

            rowDivider

            Menu {
                Picker("Type", selection: $draft.income) {
                    Text("Expense").tag(false)
                    Text("Income").tag(true)
                }
            } label: {
                menuRow(label: "Type", value: draft.income ? "Income" : "Expense")
            }

            rowDivider

            Button { showingAmountSheet = true } label: {
                HStack {
                    Text("Amount")
                        .font(.system(.body, design: .rounded))
                        .foregroundStyle(Color.PrimaryText)
                    Spacer()
                    Text(formattedAmount)
                        .font(.system(.body, design: .rounded, weight: .medium))
                        .foregroundStyle(draft.amount > 0 ? (draft.income ? Color.IncomeGreen : Color.PrimaryText) : Color.SubtitleText)
                    Text(effectiveCurrency)
                        .font(.system(.caption, design: .rounded))
                        .foregroundStyle(Color.SubtitleText)
                }
                .formRow()
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
        }
        .groupedCard()
    }

    private var formattedAmount: String {
        draft.amount.formatted(.currency(code: effectiveCurrency).presentation(.narrow))
    }

    // MARK: - Category

    private var categoryGroup: some View {
        Button { showingCategorySheet = true } label: {
            HStack(spacing: 12) {
                if let category {
                    CategoryIconTile(
                        symbol: category.displaySymbol,
                        tint: category.income ? Color.IncomeGreen : Color(hex: category.wrappedColour),
                        size: .small
                    )
                    Text(category.wrappedName)
                        .font(.system(.body, design: .rounded))
                        .foregroundStyle(Color.PrimaryText)
                } else {
                    Text("Category")
                        .font(.system(.body, design: .rounded))
                        .foregroundStyle(categoryErrored ? Color.AlertRed : Color.PrimaryText)
                }
                Spacer()
                Text(category == nil ? "Choose" : "Change")
                    .font(.system(.subheadline, design: .rounded))
                    .foregroundStyle(Color.SubtitleText)
                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.SubtitleText)
            }
            .formRow()
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .groupedCard()
        .overlay {
            if categoryErrored {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(Color.AlertRed, lineWidth: 1.5)
            }
        }
        .offset(x: categoryShake ? -5 : 0)
    }

    // MARK: - Schedule

    @ViewBuilder
    private var scheduleGroup: some View {
        if draft.isSubscription {
            VStack(spacing: 0) {
                Menu {
                    Picker("Schedule", selection: scheduleSelection) {
                        ForEach(RecurringCadence.selectable, id: \.self) { cadence in
                            Text(cadence.label).tag(Int(cadence.rawValue))
                        }
                    }
                    Button("Custom…") { showingCustomSchedule = true }
                } label: {
                    menuRow(label: "Schedule", value: scheduleLabel)
                }

                rowDivider
                dateRow(label: "First Payment", value: draft.date.formatted(.dateTime.day().month().year()), target: .firstPayment)
                rowDivider

                Toggle(isOn: $draft.hasEndDate.animation()) {
                    Text("End Date")
                        .font(.system(.body, design: .rounded))
                        .foregroundStyle(Color.PrimaryText)
                }
                .tint(Color.IncomeGreen)
                .formRow()

                if draft.hasEndDate {
                    rowDivider
                    dateRow(label: "Ends", value: draft.endDate.formatted(.dateTime.day().month().year()), target: .endDate)
                }
            }
            .groupedCard()
        } else {
            VStack(spacing: 0) {
                dateRow(label: "Date", value: draft.date.formatted(.dateTime.weekday().day().month()), target: .date)
                rowDivider
                dateRow(label: "Time", value: draft.date.formatted(.dateTime.hour().minute()), target: .time)
            }
            .groupedCard()
        }
    }

    /// Selecting a named schedule resets the coefficient to 1; custom intervals
    /// come from the stepper sheet instead.
    private var scheduleSelection: Binding<Int> {
        Binding(
            get: { draft.recurringType },
            set: { draft.recurringType = $0; draft.recurringCoefficient = 1 }
        )
    }

    private var scheduleLabel: String {
        let cadence = RecurringCadence(rawValue: Int16(draft.recurringType)) ?? .monthly
        return cadence.scheduleLabel(coefficient: Int16(draft.recurringCoefficient))
    }

    private func dateRow(label: LocalizedStringKey, value: String, target: DatePickerTarget) -> some View {
        Button { activeDatePicker = target } label: {
            HStack {
                Text(label)
                    .font(.system(.body, design: .rounded))
                    .foregroundStyle(Color.PrimaryText)
                Spacer()
                Text(value)
                    .font(.system(.subheadline, design: .rounded, weight: .medium))
                    .foregroundStyle(Color.PrimaryText)
                    .padding(.horizontal, 11)
                    .padding(.vertical, 6)
                    .background(Color.PrimaryText.opacity(0.07), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
            }
            .formRow()
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func datePickerSheet(_ target: DatePickerTarget) -> some View {
        let binding: Binding<Date> = (target == .endDate) ? $draft.endDate : $draft.date
        NavigationStack {
            Group {
                if target == .time {
                    DatePicker("", selection: binding, displayedComponents: [.hourAndMinute])
                        .datePickerStyle(.wheel)
                } else {
                    DatePicker("", selection: binding, displayedComponents: [.date])
                        .datePickerStyle(.graphical)
                }
            }
            .labelsHidden()
            .padding()
            .frame(maxHeight: .infinity, alignment: .top)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { activeDatePicker = nil }
                }
            }
        }
        .presentationDetents([.medium])
    }

    // MARK: - CTA + toast

    private var cta: some View {
        Button(action: submit) {
            Text(ctaTitle)
                .font(.system(.body, design: .rounded, weight: .semibold))
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .tint(Color.PrimaryText)
        .foregroundStyle(Color.PrimaryBackground)
        .controlSize(.large)
        .disabled(!draft.canSave)
        .padding(.horizontal, 20)
        .padding(.bottom, 12)
        .background(
            LinearGradient(
                colors: [Color(.systemGroupedBackground).opacity(0), Color(.systemGroupedBackground)],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            .allowsHitTesting(false)
        )
    }

    private var ctaTitle: String {
        if isEditing { return "Save Changes" }
        return draft.isSubscription ? "Add Subscription" : "Add Transaction"
    }

    @ViewBuilder
    private var toast: some View {
        if showToast {
            Label(draft.isSubscription ? "Subscription added" : "Transaction added", systemImage: "checkmark")
                .font(.system(.subheadline, design: .rounded, weight: .semibold))
                .foregroundStyle(Color.IncomeGreen)
                .padding(.horizontal, 18)
                .padding(.vertical, 10)
                .background(Color.SecondaryBackground, in: Capsule())
                .overlay(Capsule().strokeBorder(Color.PrimaryText.opacity(0.12)))
                .padding(.bottom, 90)
                .transition(.move(edge: .bottom).combined(with: .opacity))
        }
    }

    // MARK: - Seed / save / delete

    private func seed() {
        guard !hasSeeded else { return }
        hasSeeded = true
        if let toEdit {
            draft = TransactionFormDraft.from(toEdit)
            category = toEdit.category
        } else {
            if let presetCategory {
                category = presetCategory
                draft.income = presetCategory.income
            }
            draft.endDate = Calendar.current.date(byAdding: .year, value: 1, to: .now) ?? .now
        }
    }

    private func submit() {
        guard draft.canSave else { return }
        guard let category else {
            flagMissingCategory()
            return
        }

        UINotificationFeedbackGenerator().notificationOccurred(.success)

        let transaction = toEdit ?? Transaction(context: moc)
        if toEdit == nil { transaction.id = UUID() }

        draft.apply(to: transaction, category: category)

        if draft.needsRecurrenceBackfill {
            dataController.updateRecurringTransaction(transaction: transaction)
        }

        dataController.save()

        if isEditing {
            dismiss()
        } else {
            withAnimation { showToast = true }
            Task { @MainActor in
                try? await Task.sleep(for: .seconds(0.6))
                dismiss()
            }
        }
    }

    private func flagMissingCategory() {
        UINotificationFeedbackGenerator().notificationOccurred(.error)
        withAnimation(.easeOut(duration: 0.6)) { categoryErrored = true }
        withAnimation(.easeInOut(duration: 0.1).repeatCount(5)) { categoryShake = true }
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(0.5))
            withAnimation(.easeInOut(duration: 0.1)) { categoryShake = false }
        }
    }

    private func performDelete() {
        guard let toEdit else { return }
        withAnimation {
            moc.delete(toEdit)
            dataController.save()
        }
        dismiss()
    }
}

// MARK: - Custom schedule stepper sheet

private struct CustomScheduleSheet: View {
    @Binding var recurringType: Int
    @Binding var recurringCoefficient: Int

    @Environment(\.dismiss) private var dismiss
    @State private var localType = Int(RecurringCadence.monthly.rawValue)
    @State private var localCoefficient = 2

    private var localCadence: RecurringCadence {
        RecurringCadence(rawValue: Int16(localType)) ?? .monthly
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Stepper(value: $localCoefficient, in: 1...30) {
                        HStack {
                            Text("Every")
                                .font(.system(.body, design: .rounded))
                            Spacer()
                            Text("\(localCoefficient)")
                                .font(.system(.body, design: .rounded, weight: .semibold))
                                .foregroundStyle(Color.SubtitleText)
                        }
                    }
                    Picker("Unit", selection: $localType) {
                        ForEach(RecurringCadence.selectable, id: \.self) { cadence in
                            Text(cadence.unitTitle).tag(Int(cadence.rawValue))
                        }
                    }
                    .pickerStyle(.segmented)
                } footer: {
                    Text(preview)
                        .font(.system(.footnote, design: .rounded))
                }
            }
            .navigationTitle("Custom Schedule")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        recurringType = localType
                        recurringCoefficient = localCoefficient
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
        }
        .presentationDetents([.medium])
        .onAppear {
            localType = recurringType == 0 ? Int(RecurringCadence.monthly.rawValue) : recurringType
            localCoefficient = max(1, recurringCoefficient)
        }
    }

    private var preview: String {
        let unit = localCadence.unitPlural
        return localCoefficient <= 1 ? "Repeats every \(unit.dropLast())" : "Repeats every \(localCoefficient) \(unit)"
    }
}

// MARK: - Row styling

private extension View {
    func formRow() -> some View {
        padding(.horizontal, 16)
            .frame(minHeight: 50)
    }

    func groupedCard() -> some View {
        background(Color.SecondaryBackground, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

private extension TransactionFormView {
    var rowDivider: some View {
        Divider().overlay(Color.PrimaryText.opacity(0.08)).padding(.leading, 16)
    }

    func menuRow(label: LocalizedStringKey, value: String) -> some View {
        HStack {
            Text(label)
                .font(.system(.body, design: .rounded))
                .foregroundStyle(Color.PrimaryText)
            Spacer()
            Text(value)
                .font(.system(.body, design: .rounded))
                .foregroundStyle(Color.PrimaryText)
            Image(systemName: "chevron.up.chevron.down")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.SubtitleText)
        }
        .formRow()
        .contentShape(.rect)
    }
}

#Preview("Add — one-time") {
    let controller = DataController(inMemory: true)
    return TransactionFormView()
        .environment(\.managedObjectContext, controller.container.viewContext)
        .environment(controller)
}

#Preview("Add — subscription, dark") {
    let controller = DataController(inMemory: true)
    return TransactionFormView()
        .environment(\.managedObjectContext, controller.container.viewContext)
        .environment(controller)
        .preferredColorScheme(.dark)
}
