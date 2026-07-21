import Foundation
import NumberFlow
import XCTest

final class FlowStateDiffTests: XCTestCase {
    private let format = Decimal.FormatStyle.number.locale(Locale(identifier: "en_US"))

    private func parts(_ value: Decimal) -> [KeyedPart] {
        NumberFlowFormatter.decompose(format.attributedString(for: value))
    }

    private func slot(_ state: FlowState, _ key: String) -> FlowState.Slot? {
        state.slots.first { $0.key == key }
    }

    func testSettledInitialState() {
        let state = FlowState(parts: parts(42))
        XCTAssertEqual(state.slots.count, 2)
        XCTAssertEqual(slot(state, "integer:0")?.position, 2)
        XCTAssertEqual(slot(state, "integer:1")?.position, 4)
        XCTAssertEqual(slot(state, "integer:0")?.opacity, 1)
        XCTAssertFalse(state.slots.contains { $0.isExiting })
    }

    func testDigitCountGrowth999To1000() {
        var state = FlowState(parts: parts(999))
        let newParts = parts(1000)
        let diff = state.prepare(parts: newParts)

        XCTAssertEqual(diff.entering, ["integer:3", "group:0"])
        XCTAssertTrue(diff.exiting.isEmpty)
        XCTAssertEqual(diff.updating, ["integer:0", "integer:1", "integer:2"])

        XCTAssertEqual(slot(state, "integer:3")?.position, 0, "entering digits start at 0")
        XCTAssertEqual(slot(state, "integer:3")?.opacity, 0)

        state.roll(diff, parts: newParts, direction: NumberFlowTrend.auto.resolve(from: 999, to: 1000))

        XCTAssertEqual(slot(state, "integer:0")?.position, 10,
                       "9 -> 0 going up is one step forward on the cylinder, not nine back")
        XCTAssertEqual(slot(state, "integer:1")?.position, 10)
        XCTAssertEqual(slot(state, "integer:2")?.position, 10)
        XCTAssertEqual(slot(state, "integer:3")?.position, 1, "entering digit rolls 0 -> 1")

        state.fade(diff)
        XCTAssertEqual(slot(state, "integer:3")?.opacity, 1)
    }

    func testDigitCountGrowth99To100() {
        var state = FlowState(parts: parts(99))
        let newParts = parts(100)
        let diff = state.prepare(parts: newParts)

        XCTAssertEqual(diff.entering, ["integer:2"])
        XCTAssertTrue(diff.exiting.isEmpty)

        state.roll(diff, parts: newParts, direction: NumberFlowTrend.auto.resolve(from: 99, to: 100))
        XCTAssertEqual(slot(state, "integer:0")?.position, 10)
        XCTAssertEqual(slot(state, "integer:1")?.position, 10)
        XCTAssertEqual(slot(state, "integer:2")?.position, 1)
    }

    func testDigitCountShrink100To99() {
        var state = FlowState(parts: parts(100))
        let newParts = parts(99)
        let diff = state.prepare(parts: newParts)

        XCTAssertEqual(diff.exiting, ["integer:2"])
        XCTAssertTrue(diff.entering.isEmpty)
        XCTAssertEqual(slot(state, "integer:2")?.isExiting, true)
        XCTAssertEqual(state.slots.first?.key, "integer:2",
                       "the exiting leading digit keeps its visual position while leaving")

        state.roll(diff, parts: newParts, direction: NumberFlowTrend.auto.resolve(from: 100, to: 99))
        XCTAssertEqual(slot(state, "integer:2")?.position, 0,
                       "exiting digits roll to 0 as they leave")
        XCTAssertEqual(slot(state, "integer:1")?.position, -1, "0 -> 9 going down wraps back one step")
        XCTAssertEqual(slot(state, "integer:0")?.position, -1)

        state.fade(diff)
        XCTAssertEqual(slot(state, "integer:2")?.opacity, 0)

        state.prune(diff.exiting)
        XCTAssertNil(slot(state, "integer:2"))
        XCTAssertEqual(state.slots.map(\.key), ["integer:1", "integer:0"])
    }

    func testDigitCountShrink1000To999ExitsGroupSeparator() {
        var state = FlowState(parts: parts(1000))
        let diff = state.prepare(parts: parts(999))
        XCTAssertEqual(diff.exiting, ["integer:3", "group:0"])
        XCTAssertTrue(diff.entering.isEmpty)
    }

    func testSameValueProducesEmptyStructuralDiff() {
        var state = FlowState(parts: parts(42))
        let diff = state.prepare(parts: parts(42))
        XCTAssertTrue(diff.entering.isEmpty)
        XCTAssertTrue(diff.exiting.isEmpty)
        state.roll(diff, parts: parts(42), direction: .signOfDiff)
        XCTAssertEqual(slot(state, "integer:0")?.position, 2)
    }

    func testFormatChangeWithUnchangedValueUpdatesSlots() {
        let value = Decimal(string: "1234.50")!
        let usd = Decimal.FormatStyle.Currency(code: "USD").locale(Locale(identifier: "en_US"))
        let jpy = Decimal.FormatStyle.Currency(code: "JPY").locale(Locale(identifier: "en_US"))
        let usdParts = NumberFlowFormatter.decompose(usd.attributedString(for: value))
        let jpyParts = NumberFlowFormatter.decompose(jpy.attributedString(for: value))

        var state = FlowState(parts: usdParts)
        let diff = state.prepare(parts: jpyParts)

        XCTAssertEqual(diff.exiting, ["decimal:0", "fraction:0", "fraction:1"],
                       "JPY has no fraction, so the decimal tail exits")
        XCTAssertTrue(diff.updating.contains("currency:0"))

        state.roll(diff, parts: jpyParts, direction: .signOfDiff)
        XCTAssertEqual(slot(state, "currency:0")?.kind, .symbol("¥"),
                       "currency symbol swaps in place (crossfade), no remove+insert")
        XCTAssertEqual(slot(state, "currency:0")?.isExiting, false)
        XCTAssertEqual(slot(state, "currency:0")?.opacity, 1)
        XCTAssertEqual(slot(state, "integer:0")?.position, 4,
                       "1234.50 formats as ¥1,234 (ICU half-even rounding)")

        state.fade(diff)
        XCTAssertEqual(slot(state, "fraction:0")?.opacity, 0)
        state.prune(diff.exiting)
        XCTAssertNil(slot(state, "fraction:0"))
        XCTAssertNil(slot(state, "decimal:0"))
    }

    func testOverlappingUpdatesPruneOnlyTheirOwnExits() {
        var state = FlowState(parts: parts(1000))

        let diffA = state.prepare(parts: parts(999))
        state.roll(diffA, parts: parts(999), direction: .down)
        state.fade(diffA)
        XCTAssertEqual(diffA.exiting, ["integer:3", "group:0"])

        let diffB = state.prepare(parts: parts(99))
        state.roll(diffB, parts: parts(99), direction: .down)
        state.fade(diffB)
        XCTAssertEqual(diffB.exiting, ["integer:2"], "already-exiting slots are not re-marked")

        state.prune(diffA.exiting)
        XCTAssertNil(slot(state, "integer:3"))
        XCTAssertNil(slot(state, "group:0"))
        XCTAssertEqual(slot(state, "integer:2")?.isExiting, true,
                       "update A's completion must not delete update B's in-flight exit")

        state.prune(diffB.exiting)
        XCTAssertNil(slot(state, "integer:2"))
    }

    func testReclaimedMidExitSlotContinuesFromItsCurrentPosition() {
        var state = FlowState(parts: parts(100))

        let exitDiff = state.prepare(parts: parts(99))
        state.roll(exitDiff, parts: parts(99), direction: .down)
        state.fade(exitDiff)
        XCTAssertEqual(slot(state, "integer:2")?.position, 0)

        let reclaimDiff = state.prepare(parts: parts(100))
        XCTAssertEqual(slot(state, "integer:2")?.isExiting, false)
        XCTAssertEqual(slot(state, "integer:2")?.position, 0,
                       "reclaim preserves the in-flight position instead of resetting")

        state.roll(reclaimDiff, parts: parts(100), direction: .up)
        XCTAssertEqual(slot(state, "integer:2")?.position, 1,
                       "the reclaimed digit continues 0 -> 1, not from a reset origin")
        state.fade(reclaimDiff)
        XCTAssertEqual(slot(state, "integer:2")?.opacity, 1)
    }

    func testSignFlipExitsTheSignSymbol() {
        var state = FlowState(parts: parts(-5))
        XCTAssertNotNil(slot(state, "sign:0"))

        let diff = state.prepare(parts: parts(5))
        XCTAssertEqual(diff.exiting, ["sign:0"])

        state.roll(diff, parts: parts(5), direction: NumberFlowTrend.auto.resolve(from: -5, to: 5))
        state.fade(diff)
        XCTAssertEqual(slot(state, "sign:0")?.opacity, 0)
        state.prune(diff.exiting)
        XCTAssertNil(slot(state, "sign:0"))
        XCTAssertEqual(slot(state, "integer:0")?.position, 5,
                       "the digit glyph is unchanged; only the sign crossfades out")
    }

    func testZeroToValueAndBack() {
        var state = FlowState(parts: parts(0))
        XCTAssertEqual(slot(state, "integer:0")?.position, 0)

        let up = state.prepare(parts: parts(5))
        state.roll(up, parts: parts(5), direction: .up)
        XCTAssertEqual(slot(state, "integer:0")?.position, 5)

        let down = state.prepare(parts: parts(0))
        state.roll(down, parts: parts(0), direction: .down)
        XCTAssertEqual(slot(state, "integer:0")?.position, 0)
        XCTAssertTrue(down.entering.isEmpty)
        XCTAssertTrue(down.exiting.isEmpty)
    }

    /// Regression for the "large amount → overlapping glyphs" report: driving the
    /// exact repro sequence (MXN, 3 → 36,055,580 → with decimals) must never yield
    /// two slots with the same id at any point in the animated lifecycle — a
    /// duplicate id is what would make ForEach stack glyphs on top of each other.
    /// (The visual overlap was app-side font scaling, not the package; this pins
    /// that the package layout stays sound under rapid N-digit growth.)
    func testLargeCurrencyGrowthKeepsSlotIdsUnique() {
        let mxn = Decimal.FormatStyle.Currency(code: "MXN").locale(Locale(identifier: "en_US"))
        func parts(_ value: Decimal) -> [KeyedPart] {
            NumberFlowFormatter.decompose(mxn.attributedString(for: value))
        }
        let sequence: [Decimal] = [
            3, 36, 360, 3605, 36055, 360555, 3_605_558, 36_055_580,
            Decimal(string: "36055580.5")!, Decimal(string: "36055580.55")!,
            36_055_580, 3605, 3
        ]

        var state = FlowState(parts: parts(sequence[0]))
        for value in sequence.dropFirst() {
            let newParts = parts(value)
            let diff = state.prepare(parts: newParts)

            // Peak slot count: entering + updating + still-exiting all coexist here,
            // exactly the frame the HStack renders. Ids must be unique.
            let ids = state.slots.map(\.id)
            XCTAssertEqual(Set(ids).count, ids.count, "duplicate slot id at \(value): \(ids)")
            XCTAssertNotNil(slot(state, "integer:0"), "ones place must always exist at \(value)")

            state.roll(diff, parts: newParts, direction: .signOfDiff)
            state.fade(diff)
            state.prune(diff.exiting)

            let settled = state.slots.map(\.id)
            XCTAssertEqual(Set(settled).count, settled.count, "duplicate after prune at \(value): \(settled)")
        }
    }

    func testHiINLakhGroupingGainsSecondSeparator() {
        let hi = Decimal.FormatStyle.number.locale(Locale(identifier: "hi_IN"))
        let before = NumberFlowFormatter.decompose(hi.attributedString(for: 99999))
        let after = NumberFlowFormatter.decompose(hi.attributedString(for: 100000))

        var state = FlowState(parts: before)
        let diff = state.prepare(parts: after)
        XCTAssertTrue(diff.entering.contains("integer:5"))
        XCTAssertTrue(diff.entering.contains("group:1"),
                      "1,00,000 gains a lakh separator keyed group:1 (rightmost stays group:0)")
        XCTAssertTrue(diff.exiting.isEmpty)
    }
}
