//
//  CategoryAlerts.swift
//  Outlayr
//

import CoreData
import HugeiconsCore
import HugeiconsSolidRounded
import SwiftUI
import UIKit

private enum CategoryField: Hashable {
    case name
}

private enum CategoryHero {
    /// Reference sizes: 90pt at rest in the header, 164pt floating over the picker.
    static let expandedSize: CGFloat = 164
    static var scale: CGFloat { expandedSize / CategoryIconTile.Size.large.tile }
    static let pickerHeight: CGFloat = 430
    static let motion = Animation.spring(response: 0.4, dampingFraction: 0.85)
    static let topPadding: CGFloat = 24
    static let bottomPadding: CGFloat = 28
    /// The empty state's caption hangs below the tile, so the header needs
    /// extra room before the first card while it is showing.
    static let captionClearance: CGFloat = 24
    static var restingCenterY: CGFloat { topPadding + CategoryIconTile.Size.large.tile / 2 }
}

private extension CategoryError {
    var alertMessage: LocalizedStringKey? {
        switch self {
        case .none: return nil
        case .incomplete: return "Please choose an icon or emoji, and a name."
        case .missingIcon: return "Please choose an icon or emoji for the category."
        case .missingName: return "Please enter a name for this category."
        case .duplicate: return "A category with this symbol and name already exists."
        case .duplicateIcon: return "Another category already uses this icon."
        case .duplicateEmoji: return "Another category already uses this emoji."
        case .duplicateName: return "Another category already uses this name."
        }
    }
}

// MARK: - Create

struct NewCategoryAlert: View {
    @Binding var income: Bool
    let budgetMode: Bool
    let parent: Category?

    init(income: Binding<Bool>, budgetMode: Bool = false, parent: Category? = nil) {
        _income = income
        self.budgetMode = budgetMode
        self.parent = parent
    }

    @Environment(\.dismiss) private var dismiss
    @Environment(\.managedObjectContext) private var moc
    @Environment(DataController.self) private var dataController

    @FetchRequest(sortDescriptors: [SortDescriptor(\.order)], predicate: NSPredicate(format: "income = %d", false))
    private var expenseCategories: FetchedResults<Category>

    @State private var name = ""
    @State private var symbol = CategorySymbolSelection()
    @State private var selectedColour = "#FFFFFF"
    @State private var errorMessage: LocalizedStringKey?
    @State private var justAdded = false
    @State private var flashTask: Task<Void, Never>?
    @State private var choosingIcon = false
    @State private var detent: PresentationDetent = .medium
    @FocusState private var focusedField: CategoryField?

    private static let maxExpenseCategories = 24

    private var atExpenseLimit: Bool { expenseCategories.count >= Self.maxExpenseCategories }
    private var isSubcategory: Bool { parent != nil }
    private var typePickerHidden: Bool { budgetMode || atExpenseLimit || isSubcategory }

    private var isValid: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !symbol.isEmpty
    }

    private var usedColours: Set<String> {
        Set(expenseCategories.map(\.wrappedColour))
    }

    private var colourCaption: Text? {
        if let parent {
            return Text("Inherits \(parent.wrappedName)'s colour.")
        }
        if income {
            return Text("Income categories use the income colour.")
        }
        return nil
    }

    /// Examples beat labels: the placeholder teaches what belongs in the field
    /// and follows the selected type live.
    private var namePlaceholder: LocalizedStringKey {
        if isSubcategory { return "Coffee, Snacks…" }
        return income ? "Salary, Freelance…" : "Groceries, Rent…"
    }

    var body: some View {
        NavigationStack {
            CategorySheetSurface(
                symbol: $symbol,
                selectedColour: $selectedColour,
                choosingIcon: $choosingIcon,
                income: income,
                showsColourRow: !income && !isSubcategory,
                usedColours: usedColours,
                onHeroTap: openPicker
            ) {
                Form {
                    CategoryNameSection(
                        name: $name,
                        typeSelection: typePickerHidden ? nil : $income,
                        placeholder: namePlaceholder,
                        caption: colourCaption,
                        focusedField: $focusedField
                    ) {
                        add()
                    }
                }
                .safeAreaInset(edge: .bottom) {
                    Button {
                        add()
                    } label: {
                        Text(isSubcategory ? "Add Subcategory" : "Add Category")
                            .font(.system(.body, design: .rounded, weight: .semibold))
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .tint(Color.PrimaryText)
                    .disabled(!isValid)
                    .padding(.horizontal, 20)
                    .padding(.bottom, 8)
                }
            }
            .navigationTitle(isSubcategory ? "New Subcategory" : "New Category")
            .navigationBarTitleDisplayMode(.inline)
            .presentationDetents([.medium, .large], selection: $detent)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        dismiss()
                    } label: {
                        ToolbarIcon(.cancel, pinnedWidth: 12)
                    }
                    .accessibilityLabel("Cancel")
                }
            }
            .alert("Couldn't Add Category", isPresented: errorBinding, presenting: errorMessage) { _ in
                Button("OK", role: .cancel) {}
            } message: { message in
                Text(message)
            }
            .onAppear {
                if let parent {
                    income = parent.income
                    selectedColour = parent.wrappedColour
                } else {
                    if atExpenseLimit { income = true }
                    selectedColour = firstAvailableColour()
                }
            }
            .onChange(of: expenseCategories.count) { _, count in
                if !isSubcategory, count >= Self.maxExpenseCategories, !income { dismiss() }
            }
            .onDisappear { flashTask?.cancel() }
            .overlay(alignment: .bottom) {
                if justAdded {
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.circle.fill")
                        Text("Category added")
                    }
                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.IncomeGreen)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(Capsule().fill(Color(.secondarySystemGroupedBackground)))
                    .overlay(Capsule().strokeBorder(Color.PrimaryText.opacity(0.12), lineWidth: 1))
                    .padding(.bottom, 20)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .animation(.spring(response: 0.35, dampingFraction: 0.8), value: justAdded)
        }
    }

    private func openPicker() {
        // The nested picker is 430pt tall; from the medium detent it would cover the
        // whole parent, so the parent grows first and stays there afterwards.
        focusedField = nil
        withAnimation(CategoryHero.motion) {
            detent = .large
            choosingIcon = true
        }
    }

    private var errorBinding: Binding<Bool> {
        Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })
    }

    private func firstAvailableColour() -> String {
        let used = usedColours
        return Color.colorArray.first { !used.contains($0) } ?? "#FFFFFF"
    }

    private func add() {
        let result = dataController.categoryCheck(
            name: name,
            icon: symbol.icon,
            emoji: symbol.emoji,
            income: income
        )

        guard result.error == .none else {
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            errorMessage = result.error.alertMessage
            switch result.error {
            case .missingName, .duplicateName: focusedField = .name
            default: break
            }
            return
        }

        let category = Category(context: moc)
        category.name = name.trimmingCharacters(in: .whitespaces).capitalized
        symbol.apply(to: category)
        category.dateCreated = .now
        category.id = UUID()
        category.income = income
        category.parent = parent
        if let parent {
            category.order = (parent.sortedChildren.last?.order ?? -1) + 1
            category.colour = income ? "IncomeGreen" : parent.wrappedColour
        } else {
            category.order = result.order
            category.colour = income ? "IncomeGreen" : selectedColour
        }
        dataController.save()

        UINotificationFeedbackGenerator().notificationOccurred(.success)

        if budgetMode || parent != nil {
            dismiss()
            return
        }

        name = ""
        symbol = CategorySymbolSelection()
        selectedColour = firstAvailableColour()
        flashAddedConfirmation()
    }

    private func flashAddedConfirmation() {
        // Back-to-back adds must not let the first timer clear the second flash.
        flashTask?.cancel()
        justAdded = true
        flashTask = Task {
            try? await Task.sleep(for: .seconds(2))
            guard !Task.isCancelled else { return }
            justAdded = false
        }
    }
}

// MARK: - Edit

struct EditCategoryAlert: View {
    let toEdit: Category

    @Environment(\.dismiss) private var dismiss
    @Environment(DataController.self) private var dataController

    @FetchRequest(sortDescriptors: [SortDescriptor(\.order)], predicate: NSPredicate(format: "income = %d", false))
    private var expenseCategories: FetchedResults<Category>

    @State private var name = ""
    @State private var symbol = CategorySymbolSelection()
    @State private var selectedColour = "#FFFFFF"
    @State private var errorMessage: LocalizedStringKey?
    @State private var confirmingDelete = false
    @State private var choosingIcon = false
    @State private var detent: PresentationDetent = .medium
    @FocusState private var focusedField: CategoryField?

    /// A category migrated from the emoji era has no stored icon; requiring one
    /// here would block every unrelated edit until the user picked a glyph.
    private var isValid: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && (!symbol.isEmpty || (toEdit.icon == nil && toEdit.wrappedEmoji == nil))
    }

    private var editTitle: LocalizedStringKey {
        if toEdit.isSubcategory { return "Subcategory" }
        return toEdit.income ? "Income Category" : "Expense Category"
    }

    private var deleteMessage: LocalizedStringKey {
        if toEdit.hasChildren {
            return "This can't be undone. \(toEdit.wrappedName) transactions will be deleted; its subcategories will be moved to the top level."
        }
        return "This can't be undone. All \(toEdit.wrappedName) transactions will be deleted too."
    }

    private var usedColours: Set<String> {
        Set(expenseCategories.filter { $0 != toEdit }.map(\.wrappedColour))
    }

    var body: some View {
        NavigationStack {
            CategorySheetSurface(
                symbol: $symbol,
                selectedColour: $selectedColour,
                choosingIcon: $choosingIcon,
                income: toEdit.income,
                showsColourRow: !toEdit.income && !toEdit.isSubcategory,
                usedColours: usedColours,
                onHeroTap: openPicker
            ) {
                Form {
                    CategoryNameSection(
                        name: $name,
                        placeholder: toEdit.isSubcategory
                            ? "Coffee, Snacks…"
                            : (toEdit.income ? "Salary, Freelance…" : "Groceries, Rent…"),
                        caption: nil,
                        focusedField: $focusedField
                    ) {
                        save()
                    }

                }
                .safeAreaInset(edge: .bottom) {
                    Button {
                        save()
                    } label: {
                        Text(toEdit.isSubcategory ? "Save Subcategory" : "Save Category")
                            .font(.system(.body, design: .rounded, weight: .semibold))
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .tint(Color.PrimaryText)
                    .disabled(!isValid)
                    .padding(.horizontal, 20)
                    .padding(.bottom, 8)
                }
            }
            .navigationTitle(editTitle)
            .navigationBarTitleDisplayMode(.inline)
            .presentationDetents([.medium, .large], selection: $detent)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        dismiss()
                    } label: {
                        ToolbarIcon(.cancel, pinnedWidth: 12)
                    }
                    .accessibilityLabel("Cancel")
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        confirmingDelete = true
                    } label: {
                        // Wide-ink glyph in a circular slot: pin the width for
                        // the circle, shrink the glyph so the ink fits unclipped.
                        ToolbarIcon(.delete, size: 20, color: Color.AlertRed, pinnedWidth: 15)
                    }
                    .accessibilityLabel(toEdit.isSubcategory ? "Delete Subcategory" : "Delete Category")
                }
            }
            .alert("Couldn't Save Category", isPresented: errorBinding, presenting: errorMessage) { _ in
                Button("OK", role: .cancel) {}
            } message: { message in
                Text(message)
            }
            .alert("Delete '\(toEdit.wrappedName)'?", isPresented: $confirmingDelete) {
                Button("Delete", role: .destructive) { delete() }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text(deleteMessage)
            }
            .onAppear {
                name = toEdit.wrappedName
                // The raw stored value, not `wrappedIcon`: seeding the resolved
                // fallback would let an unrecognised icon from a newer version be
                // silently overwritten with the fallback name on save.
                symbol = CategorySymbolSelection(category: toEdit)
                selectedColour = toEdit.wrappedColour
            }
        }
    }

    private func openPicker() {
        // The nested picker is 430pt tall; from the medium detent it would cover the
        // whole parent, so the parent grows first and stays there afterwards.
        focusedField = nil
        withAnimation(CategoryHero.motion) {
            detent = .large
            choosingIcon = true
        }
    }

    private var errorBinding: Binding<Bool> {
        Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })
    }

    private func save() {
        let result = dataController.categoryCheckEdit(
            name: name,
            icon: symbol.icon,
            emoji: symbol.emoji,
            toEdit: toEdit
        )

        guard result.error == .none else {
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            errorMessage = result.error.alertMessage
            switch result.error {
            case .missingName, .duplicateName: focusedField = .name
            default: break
            }
            return
        }

        toEdit.name = name.trimmingCharacters(in: .whitespaces).capitalized
        symbol.apply(to: toEdit)
        if !toEdit.income {
            toEdit.colour = selectedColour
        }
        dataController.save()

        UINotificationFeedbackGenerator().notificationOccurred(.success)
        dismiss()
    }

    private func delete() {
        UINotificationFeedbackGenerator().notificationOccurred(.warning)
        dataController.container.viewContext.delete(toEdit)
        dataController.save()
        dismiss()
    }
}

// MARK: - Sheet surface

/// Hosts the form on the native grouped surface and owns what sits outside it:
/// the ambient glow, the fixed hero header, and the nested icon picker.
///
/// The hero never lives inside the `Form` (per-cell UIKit hosting breaks both
/// matched geometry and preference propagation) — it sits in a fixed header
/// above it, like the reference app, and travels to its floating placement
/// with a plain deterministic offset+scale spring.
private struct CategorySheetSurface<FormContent: View>: View {
    @Binding var symbol: CategorySymbolSelection
    @Binding var selectedColour: String
    @Binding var choosingIcon: Bool
    let income: Bool
    let showsColourRow: Bool
    let usedColours: Set<String>
    let onHeroTap: () -> Void
    @ViewBuilder let form: FormContent

    private var tint: Color {
        income ? Color.IncomeGreen : Color(hex: selectedColour)
    }

    private var hasSymbol: Bool { !symbol.isEmpty }

    private var previewSymbol: CategorySymbol {
        // Icon-first, matching `displaySymbol`; the selection type makes the
        // both-set case unreachable, but the two orders must not disagree.
        if !symbol.icon.isEmpty {
            return .icon(CategoryIconCatalog.icon(named: symbol.icon) ?? CategoryIconCatalog.fallback(income: income))
        }
        if !symbol.emoji.isEmpty { return .emoji(symbol.emoji) }
        return .icon(CategoryIconCatalog.fallback(income: income))
    }

    @Environment(\.colorScheme) private var colorScheme

    /// No curtain until the category has an identity of its own.
    private var glowOpacity: Double {
        hasSymbol ? 1 : 0
    }

    var body: some View {
        GeometryReader { proxy in
            VStack(spacing: 0) {
                hero(in: proxy)
                    .padding(.top, CategoryHero.topPadding)
                    .padding(.bottom, CategoryHero.bottomPadding + (hasSymbol ? 0 : CategoryHero.captionClearance))
                    .frame(maxWidth: .infinity)
                    .zIndex(1)

                form
                    .scrollContentBackground(.hidden)
                    .contentMargins(.top, 8, for: .scrollContent)
                    .opacity(choosingIcon ? 0 : 1)
                    .blur(radius: choosingIcon ? 8 : 0)
                    .allowsHitTesting(!choosingIcon)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
            .background { backgroundLayer }
            .animation(CategoryHero.motion, value: choosingIcon)
        }
        .sheet(isPresented: $choosingIcon) {
            CategoryIconPickerSheet(
                symbol: $symbol,
                selectedColour: $selectedColour,
                tint: tint,
                showsColourRow: showsColourRow,
                usedColours: usedColours
            )
        }
    }

    private func hero(in proxy: GeometryProxy) -> some View {
        Button(action: onHeroTap) {
            if hasSymbol {
                CategoryIconTile(symbol: previewSymbol, tint: tint, size: .large)
            } else {
                emptyHeroTile
            }
        }
        .buttonStyle(GridPressStyle())
        .disabled(choosingIcon)
        .accessibilityLabel("Category icon")
        .accessibilityHint("Opens the icon picker")
        .overlay(alignment: .topTrailing) {
            if hasSymbol && !choosingIcon {
                resetBadge
            }
        }
        .scaleEffect(choosingIcon ? CategoryHero.scale : 1)
        .offset(y: choosingIcon ? openHeroOffset(in: proxy) : 0)
    }

    /// The filled-state twin of the empty state's "+" badge: same size and
    /// weight, danger-tinted, clearing the symbol back to the invitation.
    private var resetBadge: some View {
        Button {
            withAnimation(CategoryHero.motion) {
                symbol = CategorySymbolSelection()
            }
        } label: {
            Circle()
                .fill(Color.AlertRed)
                .frame(width: 26, height: 26)
                .overlay {
                    ToolbarIcon(.cancel, size: 14, color: .white)
                }
        }
        .buttonStyle(.plain)
        .offset(x: 8, y: -8)
        .accessibilityLabel("Remove icon")
    }

    /// Speaks the Budgets empty state's ghost dialect: soft fill, gentle dashed
    /// outline, sparkles, a "+" badge that reads as tappable, and an invitation
    /// below. The decoration hides while the tile floats over the picker.
    private var emptyHeroTile: some View {
        let radius = CategoryIconTile.Size.large.radius
        let tile = CategoryIconTile.Size.large.tile
        return RoundedRectangle(cornerRadius: radius, style: .continuous)
            .fill(Color.SubtitleText.opacity(0.05))
            .frame(width: tile, height: tile)
            .overlay {
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .strokeBorder(
                        Color.SubtitleText.opacity(0.32),
                        style: StrokeStyle(lineWidth: 1.8, dash: [5, 5])
                    )
            }
            .overlay {
                if !choosingIcon {
                    heroInvitation
                }
            }
    }

    private var heroInvitation: some View {
        ZStack {
            Image(systemName: "sparkle")
                .font(.system(size: 12))
                .foregroundStyle(Color.SubtitleText.opacity(0.45))
                .offset(x: -62, y: -30)

            Image(systemName: "sparkle")
                .font(.system(size: 9))
                .foregroundStyle(Color.SubtitleText.opacity(0.45))
                .offset(x: 60, y: 8)

            Circle()
                .fill(Color.PrimaryText)
                .frame(width: 26, height: 26)
                .overlay {
                    ToolbarIcon(.plusSign, style: .solidRounded, size: 14, color: Color.PrimaryBackground)
                }
                .offset(
                    x: CategoryIconTile.Size.large.tile / 2 - 6,
                    y: CategoryIconTile.Size.large.tile / 2 - 6
                )

            Text("Choose an icon & colour")
                .font(.system(.footnote, design: .rounded, weight: .medium))
                .foregroundStyle(Color.SubtitleText)
                .fixedSize()
                .offset(y: CategoryIconTile.Size.large.tile / 2 + 22)
        }
    }

    /// How far the hero travels down to sit centred in the space the picker
    /// leaves uncovered, measured from its resting spot in the header.
    private func openHeroOffset(in proxy: GeometryProxy) -> CGFloat {
        let restingCenter = CategoryHero.restingCenterY
        let heroHalf = CategoryIconTile.Size.large.tile * CategoryHero.scale / 2
        let free = proxy.size.height - CategoryHero.pickerHeight
        let target = max(free / 2, 16 + heroHalf)
        return target - restingCenter
    }

    /// Icons glow in the category tint alone; emoji blend their own dominant
    /// hues at the core with the chosen category colour at the rim.
    private var glowColors: [Color] {
        if case let .emoji(emoji) = previewSymbol, hasSymbol {
            let derived = EmojiGlow.colors(for: emoji)
            if !derived.isEmpty { return derived + [tint] }
        }
        return [tint]
    }

    /// The Health-app treatment, measured from the real app: pastel accents
    /// (pre-mixed toward white) morphing horizontally across the top — the way
    /// Health blends pinned sections' colours — dissolving by 260pt, before
    /// the first card. iOS 18 gets the organic MeshGradient morph; 17 falls
    /// back to a linear blend under a vertical fade mask.
    private var backgroundLayer: some View {
        Color(.systemGroupedBackground)
            .overlay(alignment: .top) {
                curtain
                    // Hues must NEVER animate: mesh colours interpolate
                    // column-by-column, which reads as a left-to-right sweep.
                    // Stripping the transaction here is the only reliable way —
                    // removing .animation modifiers is not enough, because the
                    // descend's animation rides the same transaction as the hue
                    // change and would animate the colours too.
                    .transaction { $0.animation = nil }
                    .frame(height: 260)
                    .frame(maxWidth: .infinity)
                    .opacity(glowOpacity)
                    // The only animated motion: descending from the top edge.
                    .offset(y: hasSymbol ? 0 : -260)
                    .animation(.easeInOut(duration: 0.45), value: hasSymbol)
            }
            .ignoresSafeArea()
    }

    /// Exactly three hues for the mesh's top row: emoji dominants lead,
    /// the chosen colour closes.
    private var curtainHues: [Color] {
        let shades = glowColors.map { CategoryTileShading.curtain($0, in: colorScheme) }
        switch shades.count {
        case 1: return [shades[0], shades[0], shades[0]]
        case 2: return [shades[0], shades[0], shades[1]]
        default: return Array(shades.prefix(3))
        }
    }

    @ViewBuilder
    private var curtain: some View {
        let hues = curtainHues
        if #available(iOS 18.0, *) {
            MeshGradient(
                width: 3,
                height: 3,
                points: [
                    [0, 0], [0.5, 0], [1, 0],
                    [0, 0.5], [0.5, 0.42], [1, 0.5],
                    [0, 1], [0.5, 1], [1, 1]
                ],
                colors: [
                    hues[0], hues[1], hues[2],
                    hues[0].opacity(0.55), hues[1].opacity(0.5), hues[2].opacity(0.55),
                    hues[0].opacity(0), hues[1].opacity(0), hues[2].opacity(0)
                ]
            )
        } else {
            LinearGradient(colors: hues, startPoint: .leading, endPoint: .trailing)
                .mask(
                    LinearGradient(
                        stops: [
                            .init(color: .black, location: 0),
                            .init(color: .black, location: 0.45),
                            .init(color: .clear, location: 1)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
        }
    }
}

// MARK: - Nested icon picker

private struct CategoryIconPickerSheet: View {
    @Binding var symbol: CategorySymbolSelection
    @Binding var selectedColour: String
    let tint: Color
    let showsColourRow: Bool
    let usedColours: Set<String>

    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var tab: SymbolTab = .icons
    @State private var keyboardEmoji = ""
    @FocusState private var searchFocused: Bool
    @FocusState private var emojiKeyboardFocused: Bool

    private enum SymbolTab: Hashable {
        case icons
        case emoji
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Spacer()
                Button("Done") { dismiss() }
                    .font(.body.weight(.semibold))
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
            .padding(.bottom, 8)

            Picker("Symbol Type", selection: $tab) {
                Text("Icons").tag(SymbolTab.icons)
                Text("Emoji").tag(SymbolTab.emoji)
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 20)
            .padding(.bottom, 12)

            // The emoji palette has no keywords to search against, so the field
            // only exists on the icons tab rather than shipping as dead UI.
            if tab == .icons {
                searchField
            }

            if showsColourRow {
                ColourPickerView(selectedColour: $selectedColour, usedColours: usedColours)
                    .padding(.bottom, 8)
            }

            ScrollView {
                switch tab {
                case .icons:
                    CategoryIconBrowser(
                        selection: Binding(
                            get: { symbol.icon },
                            set: { symbol.selectIcon($0) }
                        ),
                        tint: tint,
                        query: query,
                        headerBackground: Color(.systemGroupedBackground)
                    )
                case .emoji:
                    CategoryEmojiBrowser(
                        selection: symbol.emoji,
                        tint: tint,
                        headerBackground: Color(.systemGroupedBackground),
                        onSelect: { symbol.selectEmoji($0) },
                        onRequestKeyboard: { emojiKeyboardFocused = true }
                    )
                }
            }
        }
        .background(emojiKeyboardField)
        .background(Color(.systemGroupedBackground))
        .presentationDetents([.height(CategoryHero.pickerHeight), .large])
        .presentationDragIndicator(.visible)
        .presentationBackgroundInteraction(.enabled(upThrough: .height(CategoryHero.pickerHeight)))
        .onDisappear {
            searchFocused = false
            emojiKeyboardFocused = false
            query = ""
        }
    }

    /// Zero-sized host for the emoji keyboard. The catalogue covers the common
    /// cases; this is the escape hatch to the rest of Unicode.
    private var emojiKeyboardField: some View {
        EmojiTextField(text: $keyboardEmoji, autoFocus: false) {
            emojiKeyboardFocused = false
        }
            .frame(width: 1, height: 1)
            .opacity(0.01)
            .focused($emojiKeyboardFocused)
            .accessibilityHidden(true)
            .onChange(of: keyboardEmoji) { _, value in
                guard !value.isEmpty else { return }
                symbol.selectEmoji(value)
                keyboardEmoji = ""
                emojiKeyboardFocused = false
            }
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)

            TextField("Search icons", text: $query)
                .focused($searchFocused)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .submitLabel(.search)

            if !query.isEmpty {
                Button {
                    query = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Color(.systemGray6))
        )
        .padding(.horizontal, 20)
        .padding(.bottom, 12)
    }
}

// MARK: - Form sections

private struct CategoryNameSection: View {
    @Binding var name: String
    var typeSelection: Binding<Bool>?
    let placeholder: LocalizedStringKey
    let caption: Text?
    var focusedField: FocusState<CategoryField?>.Binding
    let onSubmit: () -> Void

    var body: some View {
        Section {
            HStack {
                Text("Name")
                    .foregroundColor(.secondary)
                Spacer()
                TextField(placeholder, text: $name)
                    .multilineTextAlignment(.trailing)
                    .textInputAutocapitalization(.words)
                    .submitLabel(.done)
                    .focused(focusedField, equals: .name)
                    .onSubmit(onSubmit)
            }

            if let typeSelection {
                HStack {
                    Text("Type")
                        .foregroundColor(.secondary)
                    Spacer()
                    Picker("Type", selection: typeSelection) {
                        Text("Expense").tag(false)
                        Text("Income").tag(true)
                    }
                    .pickerStyle(.menu)
                    .labelsHidden()
                    .tint(.primary)
                }
            }
        } footer: {
            if let caption {
                caption
            }
        }
    }
}

// MARK: - Icon catalogue

/// The full category glyph catalogue, grouped by theme, with search.
struct CategoryIconBrowser: View {
    @Binding var selection: String
    let tint: Color
    var query: String = ""
    var headerBackground: Color = .clear

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 10), count: 6)

    private var results: [CategoryIcon] {
        CategoryIconCatalog.icons(matching: query)
    }

    private var isSearching: Bool {
        !query.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        Group {
            if isSearching {
                searchResults
            } else {
                groupedCatalog
            }
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 24)
    }

    private var groupedCatalog: some View {
        LazyVStack(alignment: .leading, spacing: 20, pinnedViews: .sectionHeaders) {
            ForEach(CategoryIconCatalog.groups) { group in
                Section {
                    grid(for: group.icons)
                } header: {
                    Text(LocalizedStringKey(group.title))
                        .font(.system(.subheadline, design: .rounded, weight: .semibold))
                        .foregroundStyle(Color.SubtitleText)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 8)
                        .background(headerBackground)
                }
            }
        }
    }

    @ViewBuilder
    private var searchResults: some View {
        if results.isEmpty {
            Text("No icons found")
                .font(.system(.subheadline, design: .rounded))
                .foregroundStyle(Color.SubtitleText)
                .frame(maxWidth: .infinity)
                .padding(.top, 60)
        } else {
            grid(for: results)
        }
    }

    private func grid(for icons: [CategoryIcon]) -> some View {
        LazyVGrid(columns: columns, spacing: 10) {
            ForEach(icons) { icon in
                IconCell(
                    icon: icon,
                    tint: tint,
                    isSelected: icon.name == selection
                ) {
                    selection = icon.name
                }
            }
        }
    }
}

/// The curated emoji palette, grouped to mirror the icon catalogue, with a
/// trailing cell that hands off to the system emoji keyboard.
private struct CategoryEmojiBrowser: View {
    let selection: String
    let tint: Color
    var headerBackground: Color = .clear
    let onSelect: (String) -> Void
    let onRequestKeyboard: () -> Void

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 10), count: 6)

    var body: some View {
        LazyVStack(alignment: .leading, spacing: 20, pinnedViews: .sectionHeaders) {
            ForEach(CategoryEmojiCatalog.groups) { group in
                Section {
                    LazyVGrid(columns: columns, spacing: 10) {
                        ForEach(group.emojis, id: \.self) { emoji in
                            EmojiCell(
                                emoji: emoji,
                                tint: tint,
                                isSelected: emoji == selection
                            ) {
                                onSelect(emoji)
                            }
                        }

                        if group.id == CategoryEmojiCatalog.groups.last?.id {
                            keyboardCell
                        }
                    }
                } header: {
                    Text(LocalizedStringKey(group.title))
                        .font(.system(.subheadline, design: .rounded, weight: .semibold))
                        .foregroundStyle(Color.SubtitleText)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 8)
                        .background(headerBackground)
                }
            }
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 24)
    }

    private var keyboardCell: some View {
        Button(action: onRequestKeyboard) {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Color.SecondaryBackground)
                .aspectRatio(1, contentMode: .fit)
                .overlay {
                    Image(systemName: "keyboard")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundStyle(Color.SubtitleText)
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("More emoji")
        .accessibilityHint("Opens the emoji keyboard")
    }
}

private struct EmojiCell: View {
    let emoji: String
    let tint: Color
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(isSelected ? tint.opacity(0.18) : Color.SecondaryBackground)
                .aspectRatio(1, contentMode: .fit)
                .overlay {
                    Text(emoji)
                        .font(.system(size: 26))
                }
                .overlay {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .strokeBorder(tint, lineWidth: isSelected ? 2 : 0)
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(verbatim: emoji))
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

/// A `UITextField` subclass that forces the emoji keyboard and hides the caret.
/// SwiftUI has no native way to restrict input to the emoji keyboard, so this
/// thin `UIViewRepresentable` bridge is the sanctioned escape hatch.
private final class UIEmojiTextField: UITextField {
    override var textInputMode: UITextInputMode? {
        .activeInputModes.first { $0.primaryLanguage == "emoji" }
    }

    override func caretRect(for _: UITextPosition) -> CGRect {
        .zero
    }
}

private struct EmojiTextField: UIViewRepresentable {
    @Binding var text: String
    var autoFocus: Bool = true
    var onEndEditing: () -> Void = {}

    func makeUIView(context: Context) -> UIEmojiTextField {
        let field = UIEmojiTextField()
        field.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        field.text = text
        field.delegate = context.coordinator
        field.textAlignment = .center
        if autoFocus {
            field.becomeFirstResponder()
        }
        return field
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(text: $text, onEndEditing: onEndEditing)
    }

    func updateUIView(_ uiView: UIEmojiTextField, context: Context) {
        context.coordinator.onEndEditing = onEndEditing
        if uiView.text != text {
            uiView.text = text
        }
    }

    /// Holds the binding rather than the parent struct: SwiftUI recreates the
    /// representable on every update, so a captured copy goes stale immediately.
    final class Coordinator: NSObject, UITextFieldDelegate {
        private let text: Binding<String>
        var onEndEditing: () -> Void

        init(text: Binding<String>, onEndEditing: @escaping () -> Void) {
            self.text = text
            self.onEndEditing = onEndEditing
        }

        func textFieldDidChangeSelection(_ textField: UITextField) {
            // Only the newest emoji survives: the field is a picker, not an input.
            let latest = String((textField.text ?? "").onlyEmoji().suffix(1))
            textField.text = latest
            text.wrappedValue = latest
        }

        func textFieldDidEndEditing(_: UITextField) {
            // Dismissing the keyboard without picking must re-arm the "More" cell,
            // which stays disabled while the focus flag is stuck on.
            onEndEditing()
        }
    }
}

private struct IconCell: View {
    let icon: CategoryIcon
    let tint: Color
    let isSelected: Bool
    let action: () -> Void

    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        Button(action: action) {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(isSelected ? tint.opacity(0.18) : Color.SecondaryBackground)
                .aspectRatio(1, contentMode: .fit)
                .overlay {
                    HugeIcon(
                        codepoint: icon.codepoint,
                        font: HugeiconsSolidRounded.font(size: 20),
                        color: isSelected
                            ? CategoryTileShading.glyph(for: tint, in: colorScheme, washOpacity: 0.18)
                            : Color.SubtitleText
                    )
                }
                .overlay {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .strokeBorder(tint, lineWidth: isSelected ? 2 : 0)
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(verbatim: icon.name))
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

// MARK: - Shared style

/// The shared press feedback for the category hero: a brief squeeze, no ripple.
struct GridPressStyle: ButtonStyle {
    var scale: CGFloat = 0.96
    var pressedOpacity: Double? = 0.85

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? scale : 1)
            .opacity(configuration.isPressed ? (pressedOpacity ?? 1) : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: configuration.isPressed)
    }
}
