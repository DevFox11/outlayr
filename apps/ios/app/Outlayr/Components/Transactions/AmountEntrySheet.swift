//
//  AmountEntrySheet.swift
//  Outlayr
//
//  Glass numpad sheet for amount entry with per-transaction currency
//  switching. The amount display rolls via NumberFlow; keys are Liquid Glass
//  on iOS 26+ with a flat-material fallback on iOS 17.
//

import NumberFlow
import SwiftUI

private enum NumpadKeyMetrics {
    static let cornerRadius: CGFloat = 16
    /// Shared by the decimal-key morph and the currency-switch renormalization
    /// so the key fade and the amount reformat stay in lockstep.
    static let morphDuration: Double = 0.25
}

/// The amount sheet's vertical rhythm, in points, from the user's layout spec.
private enum NumpadLayout {
    static let horizontalInset: CGFloat = 16
    /// Below the native header, before the "Amount" label.
    static let headerToLabel: CGFloat = 12
    /// "Amount" caption → the rolling number.
    static let labelToAmount: CGFloat = 16
    /// The rolling number → the keypad.
    static let amountToKeypad: CGFloat = 72
    /// The keypad → the Done button.
    static let keypadToDone: CGFloat = 24
    /// Done button → the safe-area edge: a standard CTA hug, not a floating gap.
    static let doneToSafeArea: CGFloat = 8
}

/// Steps the amount font down by formatted length so a max-cap amount
/// (100M + fraction + symbol) fits the sheet width. NumberFlow's digit columns
/// are fixed-metric, so `minimumScaleFactor` mis-scales them (glyphs overlap);
/// discrete size steps keyed to character count are the correct fit strategy.
enum AmountDisplayMetrics {
    /// Base step size (40pt ≈ 48pt line height). The max-cap amount
    /// "$100,000,000.00" (15 chars, narrow) already fits at the base on a ~345pt
    /// display; the down-steps are defensive for pathological longer strings
    /// (wide symbols / non-narrow locales). SF Rounded medium.
    static func fontSize(forCharacterCount count: Int) -> CGFloat {
        switch count {
        case ..<16: return 40
        case 16: return 37
        case 17: return 34
        default: return 31
        }
    }
}

struct AmountEntrySheet: View {
    @Binding var amount: Decimal
    @Binding var currency: String?
    let income: Bool
    let onDone: () -> Void

    @AppStorage(CurrencyPreference.storageKey, store: AppIdentifiers.sharedDefaults) var globalCurrency: String = CurrencyPreference.resolve()
    @AppStorage("haptics", store: AppIdentifiers.sharedDefaults) var hapticType: Int = HapticSetting.subtle.rawValue

    @State private var model: AmountEntryModel
    @State private var showingCurrencyPicker = false
    @State private var haptics = HapticTapper()

    init(amount: Binding<Decimal>, currency: Binding<String?>, income: Bool, onDone: @escaping () -> Void) {
        _amount = amount
        _currency = currency
        self.income = income
        self.onDone = onDone

        let code = CurrencyPreference.resolve(override: currency.wrappedValue)
        _model = State(initialValue: AmountEntryModel(amount: amount.wrappedValue, minorUnits: Currency.minorUnits(for: code)))
    }

    private var effectiveCurrency: String {
        currency ?? globalCurrency
    }

    private var currencySymbol: String {
        Locale.current.localizedCurrencySymbol(forCurrencyCode: effectiveCurrency) ?? effectiveCurrency
    }

    private var showsDecimalKey: Bool {
        model.minorUnits > 0
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                amountDisplay
                    .padding(.top, NumpadLayout.headerToLabel)

                keypad
                    .padding(.top, NumpadLayout.amountToKeypad)
                    .padding(.horizontal, NumpadLayout.horizontalInset)

                // At the fitted detent the spacer rests at its 24pt minimum
                // (keypad → Done); if the sheet is taller the Done still hugs the
                // bottom rather than floating mid-sheet.
                Spacer(minLength: NumpadLayout.keypadToDone)

                doneButton
                    .padding(.horizontal, NumpadLayout.horizontalInset)
                    .padding(.bottom, NumpadLayout.doneToSafeArea)
            }
            .frame(maxHeight: .infinity)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { currencyChip }
                ToolbarItem(placement: .topBarTrailing) { closeButton }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
        .onChange(of: model) {
            amount = model.amount
        }
        .onChange(of: amount) {
            guard amount != model.amount else { return }
            model = AmountEntryModel(amount: amount, minorUnits: model.minorUnits)
        }
        .onChange(of: currency) {
            withAnimation(.easeInOut(duration: NumpadKeyMetrics.morphDuration)) {
                model.switchCurrency(minorUnits: Currency.minorUnits(for: effectiveCurrency))
            }
        }
        .sheet(isPresented: $showingCurrencyPicker) {
            CurrencyPickerSheet(selected: effectiveCurrency) { code in
                currency = code
            }
        }
        .onAppear { haptics.prepare() }
        .onDisappear { haptics.stop() }
    }

    private var currencyChip: some View {
        Button {
            showingCurrencyPicker = true
        } label: {
            HStack(spacing: 6) {
                Text("\(effectiveCurrency) (\(currencySymbol))")
                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.PrimaryText)
                Image(systemName: "chevron.down")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Color.SubtitleText)
            }
        }
        .accessibilityLabel("Currency, \(effectiveCurrency)")
    }

    private var closeButton: some View {
        Button(action: onDone) {
            ToolbarIcon("cancel-01", size: 16)
        }
        .accessibilityLabel("Close")
    }

    private var amountDisplayStyle: AmountEntryDisplayStyle {
        AmountEntryDisplayStyle(
            code: effectiveCurrency,
            fractionLength: model.displayFractionLength,
            pendingSeparator: model.showsTrailingSeparator
        )
    }

    /// Length of the rendered amount, used to pick the font step so long amounts
    /// fit rather than being scaled (which mis-lays NumberFlow's fixed columns).
    private var amountFontSize: CGFloat {
        let rendered = amountDisplayStyle.locale(.current).format(model.amount)
        return AmountDisplayMetrics.fontSize(forCharacterCount: rendered.count)
    }

    private var amountDisplay: some View {
        VStack(spacing: NumpadLayout.labelToAmount) {
            Text("Amount")
                .font(.system(size: 16, design: .rounded))
                .foregroundStyle(Color.SubtitleText)

            NumberFlow(model.amount, format: amountDisplayStyle)
                .font(.system(size: amountFontSize, weight: .medium, design: .rounded))
                .foregroundStyle(income ? Color.IncomeGreen : Color.PrimaryText)
                .lineLimit(1)
                .animation(.easeInOut(duration: NumpadKeyMetrics.morphDuration), value: amountFontSize)
                .padding(.horizontal, 24)
        }
    }

    private var keypad: some View {
        VStack(spacing: 9) {
            ForEach([[1, 2, 3], [4, 5, 6], [7, 8, 9]], id: \.self) { row in
                HStack(spacing: 9) {
                    ForEach(row, id: \.self) { digit in
                        key(.digit(digit)) {
                            Text("\(digit)")
                                .font(.system(size: 30, weight: .medium, design: .rounded))
                        }
                    }
                }
            }
            HStack(spacing: 9) {
                key(.separator) {
                    Text(Locale.current.decimalSeparator ?? ".")
                        .font(.system(size: 30, weight: .medium, design: .rounded))
                }
                .opacity(showsDecimalKey ? 1 : 0)
                .scaleEffect(showsDecimalKey ? 1 : 0.85)
                .allowsHitTesting(showsDecimalKey)
                .accessibilityHidden(!showsDecimalKey)
                .animation(.easeInOut(duration: NumpadKeyMetrics.morphDuration), value: showsDecimalKey)

                key(.digit(0)) {
                    Text("0")
                        .font(.system(size: 30, weight: .medium, design: .rounded))
                }

                key(.backspace) {
                    Image(systemName: "delete.left")
                        .font(.system(size: 24, weight: .medium))
                }
                .accessibilityLabel("Delete")
            }
        }
    }

    private func key(_ key: AmountEntryModel.Key, @ViewBuilder label: () -> some View) -> some View {
        Button {
            if hapticType == HapticSetting.excessive.rawValue {
                haptics.tap()
            }
            model.press(key)
        } label: {
            label()
                .foregroundStyle(Color.PrimaryText)
                .frame(maxWidth: .infinity)
                .frame(height: 64)
                .modifier(NumpadKeySurface())
                .contentShape(RoundedRectangle(cornerRadius: NumpadKeyMetrics.cornerRadius, style: .continuous))
        }
        // Faster curve than the house spring: a numpad press must read as an
        // instant dim, not a ripple.
        .buttonStyle(GridPressStyle(pressedOpacity: 0.65, animation: .easeOut(duration: 0.08)))
    }

    private var doneButton: some View {
        Button(action: onDone) {
            Text("Done")
                .font(.system(.title3, design: .rounded).weight(.semibold))
                .foregroundStyle(Color.LightIcon)
                .frame(maxWidth: .infinity)
                .frame(height: 56)
                .background(Color.DarkBackground, in: Capsule())
        }
        .buttonStyle(GridPressStyle(pressedOpacity: 0.65, animation: .easeOut(duration: 0.08)))
    }
}

/// Currency formatting that can render an in-progress entry like "12." — the
/// pending decimal separator is spliced into the attributed output right after
/// the integer digits (so suffix symbols like de_DE's "€" stay outside it) and
/// is sourced from the same formatter that renders the digits.
struct AmountEntryDisplayStyle: NumberFlowFormatStyle {
    private typealias PartAttribute = AttributeScopes.FoundationAttributes.NumberFormatAttributes.NumberPartAttribute
    private typealias SymbolAttribute = AttributeScopes.FoundationAttributes.NumberFormatAttributes.SymbolAttribute

    var base: Decimal.FormatStyle.Currency
    var pendingSeparator: Bool

    init(code: String, fractionLength: Int, pendingSeparator: Bool) {
        // Narrow presentation renders the compact symbol ("$" for MXN, not "MX$")
        // — the header chip already shows the ISO code, so the display stays lean.
        base = .currency(code: code).precision(.fractionLength(fractionLength)).presentation(.narrow)
        self.pendingSeparator = pendingSeparator
    }

    func locale(_ locale: Locale) -> AmountEntryDisplayStyle {
        var copy = self
        copy.base = base.locale(locale)
        return copy
    }

    func format(_ value: Decimal) -> String {
        String(attributedString(for: value).characters)
    }

    func attributedString(for value: Decimal) -> AttributedString {
        var attributed = base.attributed.format(value)
        guard pendingSeparator else { return attributed }

        var insertionIndex: AttributedString.Index?
        for run in attributed.runs where run[PartAttribute.self] == .integer && run[SymbolAttribute.self] == nil {
            insertionIndex = run.range.upperBound
        }
        guard let insertionIndex else { return attributed }

        var separator = AttributedString(separatorText)
        separator[SymbolAttribute.self] = .decimalSeparator
        attributed.insert(separator, at: insertionIndex)
        return attributed
    }

    private var separatorText: String {
        let sample = base.precision(.fractionLength(1)).attributed.format(Decimal(string: "1.1")!)
        for run in sample.runs where run[SymbolAttribute.self] == .decimalSeparator {
            return String(sample.characters[run.range])
        }
        return "."
    }
}

private struct NumpadKeySurface: ViewModifier {
    func body(content: Content) -> some View {
        // .buttonStyle(.glass) imposes the gel press morph, so the glass lives
        // on the label and the press stays a plain dim/scale.
        if #available(iOS 26.0, *) {
            content.glassEffect(.regular, in: RoundedRectangle(cornerRadius: NumpadKeyMetrics.cornerRadius, style: .continuous))
        } else {
            content.background(Color.SecondaryBackground, in: RoundedRectangle(cornerRadius: NumpadKeyMetrics.cornerRadius, style: .continuous))
        }
    }
}

private struct CurrencyPickerSheet: View {
    let selected: String
    let onSelect: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var query = ""

    private var filtered: [Currency] {
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return Currency.allCurrencies }
        return Currency.allCurrencies.filter {
            $0.code.localizedCaseInsensitiveContains(trimmed) || $0.name.localizedCaseInsensitiveContains(trimmed)
        }
    }

    var body: some View {
        NavigationStack {
            List(filtered, id: \.code) { currency in
                Button {
                    onSelect(currency.code)
                    dismiss()
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 1) {
                            Text(currency.code)
                                .font(.system(.body, design: .rounded).weight(.medium))
                                .foregroundStyle(Color.PrimaryText)
                            Text(currency.name)
                                .font(.system(.caption, design: .rounded))
                                .foregroundStyle(Color.SubtitleText)
                        }
                        Spacer()
                        Text(currency.symbol)
                            .foregroundStyle(Color.SubtitleText)
                        if currency.code == selected {
                            Image(systemName: "checkmark")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Color.PrimaryText)
                        }
                    }
                }
            }
            .listStyle(.plain)
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always))
            .navigationTitle("Currency")
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.medium, .large])
    }
}

#Preview("Amount sheet") {
    @Previewable @State var amount = Decimal(string: "12.34")!
    @Previewable @State var currency: String?
    AmountEntrySheet(amount: $amount, currency: $currency, income: false) {}
}

#Preview("Amount sheet — income, dark") {
    @Previewable @State var amount = Decimal(string: "250")!
    @Previewable @State var currency: String? = "JPY"
    AmountEntrySheet(amount: $amount, currency: $currency, income: true) {}
        .preferredColorScheme(.dark)
}
