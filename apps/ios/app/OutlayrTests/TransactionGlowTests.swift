//
//  TransactionGlowTests.swift
//  OutlayrTests
//
//  Pins the curtain-hue derivation: the two image dominants lead, the chosen
//  color closes — [dom1, dom2, chosen] — with sensible fallbacks when the image
//  offers fewer than two hues.
//

import Foundation
import SwiftUI
import Testing

@testable import Outlayr

struct TransactionGlowTests {
    @Test func twoDominantsLeadAndChosenCloses() {
        #expect(
            TransactionGlow.curtainInputs(dominants: ["#AA0000", "#00BB00"], chosen: "#0000CC") ==
            ["#AA0000", "#00BB00", "#0000CC"]
        )
    }

    @Test func singleDominantRepeatsIntoTheSecondSlot() {
        #expect(
            TransactionGlow.curtainInputs(dominants: ["#AA0000"], chosen: "#0000CC") ==
            ["#AA0000", "#AA0000", "#0000CC"]
        )
    }

    @Test func noDominantsFallsBackToChosenEverywhere() {
        #expect(
            TransactionGlow.curtainInputs(dominants: [], chosen: "#0000CC") ==
            ["#0000CC", "#0000CC", "#0000CC"]
        )
    }

    @Test func alwaysYieldsExactlyThreeSlots() {
        #expect(TransactionGlow.curtainInputs(dominants: ["#111111", "#222222", "#333333"], chosen: "#444444").count == 3)
    }

    @Test func meshHuesPadToThreeForTheMeshTopRow() {
        let scheme = ColorScheme.dark
        #expect(IdentityCurtain.meshHues(from: [Color(hex: "#AA0000")], in: scheme).count == 3)
        #expect(IdentityCurtain.meshHues(from: [Color(hex: "#AA0000"), Color(hex: "#00BB00")], in: scheme).count == 3)
        #expect(IdentityCurtain.meshHues(from: [], in: scheme).isEmpty)
    }
}
