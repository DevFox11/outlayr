//
//  TransactionGlowTests.swift
//  OutlayrTests
//
//  Pins the curtain-hue derivation: the two image dominants lead, the chosen
//  colour closes — [dom1, dom2, chosen] — with sensible fallbacks when the image
//  offers fewer than two hues.
//

import SwiftUI
import XCTest

@testable import Outlayr

final class TransactionGlowTests: XCTestCase {
    func testTwoDominantsLeadAndChosenCloses() {
        XCTAssertEqual(
            TransactionGlow.curtainInputs(dominants: ["#AA0000", "#00BB00"], chosen: "#0000CC"),
            ["#AA0000", "#00BB00", "#0000CC"]
        )
    }

    func testSingleDominantRepeatsIntoTheSecondSlot() {
        XCTAssertEqual(
            TransactionGlow.curtainInputs(dominants: ["#AA0000"], chosen: "#0000CC"),
            ["#AA0000", "#AA0000", "#0000CC"]
        )
    }

    func testNoDominantsFallsBackToChosenEverywhere() {
        XCTAssertEqual(
            TransactionGlow.curtainInputs(dominants: [], chosen: "#0000CC"),
            ["#0000CC", "#0000CC", "#0000CC"]
        )
    }

    func testAlwaysYieldsExactlyThreeSlots() {
        XCTAssertEqual(TransactionGlow.curtainInputs(dominants: ["#111111", "#222222", "#333333"], chosen: "#444444").count, 3)
    }

    func testMeshHuesPadToThreeForTheMeshTopRow() {
        let scheme = ColorScheme.dark
        XCTAssertEqual(IdentityCurtain.meshHues(from: [Color(hex: "#AA0000")], in: scheme).count, 3)
        XCTAssertEqual(IdentityCurtain.meshHues(from: [Color(hex: "#AA0000"), Color(hex: "#00BB00")], in: scheme).count, 3)
        XCTAssertTrue(IdentityCurtain.meshHues(from: [], in: scheme).isEmpty)
    }
}
