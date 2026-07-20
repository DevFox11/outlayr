import NumberFlow
import XCTest

final class SignedOffsetTests: XCTestCase {
    func testWheelIsCylindrical() {
        XCTAssertEqual(DigitWheel.signedOffset(glyph: 0, position: 7), 3,
                       "glyph 0 with the wheel showing 7 sits 3 rows below, not 7 rows above")
        XCTAssertEqual(DigitWheel.signedOffset(glyph: 7, position: 7), 0)
        XCTAssertEqual(DigitWheel.signedOffset(glyph: 9, position: 0), -1)
        XCTAssertEqual(DigitWheel.signedOffset(glyph: 1, position: 0), 1)
    }

    func testFractionalPositions() {
        XCTAssertEqual(DigitWheel.signedOffset(glyph: 7, position: 6.5), 0.5, accuracy: 1e-9)
        XCTAssertEqual(DigitWheel.signedOffset(glyph: 6, position: 6.5), -0.5, accuracy: 1e-9)
    }

    func testNegativeAndUnboundedPositionsWrap() {
        XCTAssertEqual(DigitWheel.signedOffset(glyph: 9, position: -0.5), -0.5, accuracy: 1e-9)
        XCTAssertEqual(DigitWheel.signedOffset(glyph: 3, position: 23), 0)
        XCTAssertEqual(DigitWheel.signedOffset(glyph: 3, position: -17), 0)
    }

    func testOffsetsStayInHalfOpenSignedRange() {
        for glyph in 0..<10 {
            for position in stride(from: -20.0, through: 20.0, by: 0.25) {
                let offset = DigitWheel.signedOffset(glyph: glyph, position: position)
                XCTAssertGreaterThanOrEqual(offset, -5)
                XCTAssertLessThan(offset, 5)
            }
        }
    }

    func testPositiveDeltaMovesTheOutgoingGlyphUpward() {
        // RollOffset translates +offset downward, so after an upward roll (positive
        // delta) the previous glyph must have a NEGATIVE offset — it exits upward,
        // like an odometer. Guards the sign convention between RollDelta,
        // signedOffset, and the y-translation.
        let delta = RollDelta.delta(from: 7, to: 8, direction: .up)
        XCTAssertGreaterThan(delta, 0)
        XCTAssertLessThan(DigitWheel.signedOffset(glyph: 7, position: 7 + Double(delta)), 0)
        XCTAssertEqual(DigitWheel.signedOffset(glyph: 8, position: 7 + Double(delta)), 0)
    }

    func testClampingParksOffscreenGlyphs() {
        for glyph in 0..<10 {
            let clamped = DigitWheel.clampedOffset(glyph: glyph, position: 4.2)
            XCTAssertLessThanOrEqual(abs(clamped), 1.5)
        }
        for position in stride(from: 0.0, through: 10.0, by: 0.1) {
            let visible = (0..<10).filter { abs(DigitWheel.clampedOffset(glyph: $0, position: position)) < 1.5 }
            XCTAssertLessThanOrEqual(visible.count, 3, "at most 3 glyphs occupy the visible window")
        }
    }
}
