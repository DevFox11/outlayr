import SwiftUI

/// A rolling numeric display: digits spin on cylindrical wheels, symbols crossfade,
/// and digit-count changes enter/exit gracefully. Motion spec derived from
/// barvian/number-flow.
///
/// ```swift
/// NumberFlow(balance, currency: "USD")
///     .numberFlowTrend(.perDigit)
/// ```
public struct NumberFlow<Format: NumberFlowFormatStyle>: View {
    private let value: Decimal
    private let format: Format

    @Environment(\.numberFlowTransition) private var transition
    @Environment(\.numberFlowTrend) private var trend
    @Environment(\.numberFlowAnimated) private var animated
    @Environment(\.numberFlowRespectsMotionPreference) private var respectsMotionPreference
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.locale) private var locale

    @State private var state = FlowState()
    @State private var trackedValue: Decimal?

    public init(_ value: Decimal, format: Format) {
        self.value = value
        self.format = format
    }

    public var body: some View {
        Group {
            switch motion {
            case .animated:
                if NumberFlowFormatter.usesNonLatinDigits(formattedString) {
                    // The digit wheels render Latin glyphs; splicing them into
                    // Arabic-Indic (or other non-Latin) separators would garble the
                    // string, so degrade to a whole-string crossfade.
                    crossfadeBody
                } else {
                    animatedBody
                }
            case .crossfade:
                crossfadeBody
            case .disabled:
                staticBody
            }
        }
        .monospacedDigit()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: formattedString))
    }

    private var motion: NumberFlowMotion {
        MotionResolver.resolve(
            animated: animated,
            respectMotionPreference: respectsMotionPreference,
            reduceMotion: reduceMotion,
            isActive: scenePhase != .background
        )
    }

    private var localizedFormat: Format {
        format.locale(locale)
    }

    private var formattedString: String {
        localizedFormat.format(value)
    }

    private var currentParts: [KeyedPart] {
        NumberFlowFormatter.decompose(localizedFormat.attributedString(for: value))
    }

    private var animatedBody: some View {
        HStack(spacing: 0) {
            ForEach(state.slots) { slot in
                slotView(slot)
            }
        }
        // Digit runs are inherently LTR even in RTL locales; without this an RTL
        // layout direction would reverse the slot order.
        .environment(\.layoutDirection, .leftToRight)
        .modifier(NumberFlowMask())
        .onAppear {
            state = FlowState(parts: currentParts)
            trackedValue = value
        }
        // Keyed off the formatted output, not the value: currency/precision/locale
        // changes with an unchanged Decimal must re-diff too.
        .onChange(of: formattedString) {
            update()
        }
    }

    private var crossfadeBody: some View {
        Text(verbatim: formattedString)
            .contentTransition(.opacity)
            .animation(transition.opacity, value: formattedString)
    }

    private var staticBody: some View {
        Text(verbatim: formattedString)
    }

    @ViewBuilder
    private func slotView(_ slot: FlowState.Slot) -> some View {
        switch slot.kind {
        case .digit:
            DigitColumn(position: slot.position)
                .opacity(slot.opacity)
        case .symbol(let text):
            SymbolSlot(text: text)
                .opacity(slot.opacity)
        }
    }

    private func update() {
        let parts = currentParts
        let direction = trend.resolve(from: trackedValue ?? value, to: value)
        trackedValue = value

        var prepared = state
        let diff = prepared.prepare(parts: parts)
        withAnimation(transition.transform) {
            state = prepared
        }

        // Let SwiftUI present the prepared state (entering slots at wheel position 0,
        // transparent) before retargeting, so new digits visibly roll up from zero
        // instead of materializing at their final position.
        Task { @MainActor in
            withAnimation(transition.resolvedSpin) {
                state.roll(diff, parts: parts, direction: direction)
            }
            withAnimation(transition.opacity, completionCriteria: .removed) {
                state.fade(diff)
            } completion: {
                state.prune(diff.exiting)
            }
        }
    }
}

public extension NumberFlow where Format == Decimal.FormatStyle {
    /// Plain decimal formatting in the current locale.
    init(_ value: Decimal) {
        self.init(value, format: .number)
    }
}

public extension NumberFlow where Format == Decimal.FormatStyle.Currency {
    /// Currency formatting in the current locale.
    init(_ value: Decimal, currency code: String) {
        self.init(value, format: .currency(code: code))
    }
}
