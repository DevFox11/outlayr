//
//  ColorHexRoundTripTests.swift
//  OutlayrTests
//
//  The used-color contract compares stored hex strings, so a color that does
//  not survive Color(hex:) -> toHex() unchanged would silently escape the
//  duplicate check and let two categories share a swatch.
//

import Foundation
import SwiftUI
import Testing

@testable import Outlayr

struct ColorHexRoundTripTests {
    @Test func everyPaletteColorSurvivesHexRoundTrip() {
        for hex in Color.colorArray {
            let roundTripped = Color(hex: hex).toHex()
            #expect(
                roundTripped == hex,
                "Palette color \(hex) round-tripped to \(roundTripped ?? "nil")"
            )
        }
    }

    @Test func roundTripIsStableAcrossRepeatedConversions() {
        for hex in Color.colorArray {
            var current = hex
            for _ in 0 ..< 3 {
                guard let next = Color(hex: current).toHex() else {
                    Issue.record("Palette color \(hex) produced a nil hex")
                    return
                }
                current = next
            }
            #expect(current == hex, "Palette color \(hex) drifted to \(current) after repeated conversions")
        }
    }
}
