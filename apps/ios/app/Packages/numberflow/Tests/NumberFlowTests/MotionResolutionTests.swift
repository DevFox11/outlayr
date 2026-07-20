import NumberFlow
import SwiftUI
import XCTest

final class MotionResolutionTests: XCTestCase {
    func testDefaultIsFullyAnimated() {
        XCTAssertEqual(MotionResolver.resolve(reduceMotion: false), .animated)
    }

    func testReduceMotionSwitchesToCrossfade() {
        XCTAssertEqual(MotionResolver.resolve(reduceMotion: true), .crossfade)
    }

    func testReduceMotionCanBeIgnoredWhenPreferenceIsNotRespected() {
        XCTAssertEqual(
            MotionResolver.resolve(respectMotionPreference: false, reduceMotion: true),
            .animated
        )
    }

    func testAnimatedFalseDisablesEverything() {
        XCTAssertEqual(MotionResolver.resolve(animated: false, reduceMotion: false), .disabled)
        XCTAssertEqual(
            MotionResolver.resolve(animated: false, reduceMotion: true),
            .disabled,
            "animated == false wins over the crossfade fallback"
        )
    }

    func testInactiveSceneDisablesAnimation() {
        XCTAssertEqual(MotionResolver.resolve(reduceMotion: false, isActive: false), .disabled)
    }

    func testTransitionDefaultsMatchTheMotionSpec() {
        let transition = NumberFlowTransition.default
        XCTAssertEqual(transition.transform, .spring(Spring(duration: 0.61, bounce: 0)))
        XCTAssertEqual(transition.opacity, .timingCurve(0, 0, 0.58, 1, duration: 0.45))
        XCTAssertNil(transition.spin)
        XCTAssertEqual(transition.resolvedSpin, transition.transform, "spin inherits transform when nil")
    }

    func testExplicitSpinOverridesInheritance() {
        var transition = NumberFlowTransition.default
        transition.spin = .linear(duration: 0.2)
        XCTAssertEqual(transition.resolvedSpin, .linear(duration: 0.2))
    }
}
