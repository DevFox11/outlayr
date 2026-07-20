import NumberFlow
import XCTest

final class RollDeltaTests: XCTestCase {
    func testUpAlwaysRollsUpward() {
        XCTAssertEqual(RollDelta.delta(from: 8, to: 2, direction: .up), 4)
        XCTAssertEqual(RollDelta.delta(from: 2, to: 8, direction: .up), 6)
        XCTAssertEqual(RollDelta.delta(from: 7, to: 7, direction: .up), 0)
    }

    func testDownAlwaysRollsDownward() {
        XCTAssertEqual(RollDelta.delta(from: 8, to: 2, direction: .down), -6)
        XCTAssertEqual(RollDelta.delta(from: 2, to: 8, direction: .down), -4)
        XCTAssertEqual(RollDelta.delta(from: 7, to: 7, direction: .down), 0)
    }

    func testSignOfDiffMatchesWebTrendZero() {
        XCTAssertEqual(RollDelta.delta(from: 8, to: 2, direction: .signOfDiff), -6)
        XCTAssertEqual(RollDelta.delta(from: 2, to: 8, direction: .signOfDiff), 6)
    }

    func testShortestPathMatchesRNTrendZero() {
        XCTAssertEqual(RollDelta.delta(from: 8, to: 2, direction: .shortestPath), 4)
        XCTAssertEqual(RollDelta.delta(from: 2, to: 8, direction: .shortestPath), -4)
        XCTAssertEqual(RollDelta.delta(from: 6, to: 1, direction: .shortestPath), -5,
                       "ties (|diff| == wheel/2) keep the raw diff, matching the RN port")
    }

    func testPerDigitAndShortestPathDisagreeFor8To2() {
        let perDigit = RollDelta.delta(from: 8, to: 2, direction: .signOfDiff)
        let shortest = RollDelta.delta(from: 8, to: 2, direction: .shortestPath)
        XCTAssertEqual(perDigit, -6)
        XCTAssertEqual(shortest, 4)
        XCTAssertNotEqual(perDigit.signum(), shortest.signum(), "directions must differ")
        XCTAssertNotEqual(abs(perDigit), abs(shortest), "magnitudes must differ")
    }

    func testConstrainedWheelWrapsThroughItsOwnLength() {
        XCTAssertEqual(RollDelta.delta(from: 5, to: 0, direction: .up, wheel: 6), 1)
        XCTAssertEqual(RollDelta.delta(from: 0, to: 5, direction: .down, wheel: 6), -1)
    }

    func testTrendResolution() {
        XCTAssertEqual(NumberFlowTrend.auto.resolve(from: 1, to: 2), .up)
        XCTAssertEqual(NumberFlowTrend.auto.resolve(from: 2, to: 1), .down)
        XCTAssertEqual(NumberFlowTrend.auto.resolve(from: 2, to: 2), .signOfDiff,
                       "equal values fall back to per-digit sign of diff, like the web default")
        XCTAssertEqual(NumberFlowTrend.up.resolve(from: 9, to: 1), .up)
        XCTAssertEqual(NumberFlowTrend.down.resolve(from: 1, to: 9), .down)
        XCTAssertEqual(NumberFlowTrend.perDigit.resolve(from: 1, to: 9), .signOfDiff)
        XCTAssertEqual(NumberFlowTrend.shortestPath.resolve(from: 1, to: 9), .shortestPath)
    }
}
