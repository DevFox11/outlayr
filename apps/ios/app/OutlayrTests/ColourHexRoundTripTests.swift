//
//  ColourHexRoundTripTests.swift
//  OutlayrTests
//
//  The used-colour contract compares stored hex strings, so a colour that does
//  not survive Color(hex:) -> toHex() unchanged would silently escape the
//  duplicate check and let two categories share a swatch.
//

import SwiftUI
import XCTest

@testable import Outlayr

final class ColourHexRoundTripTests: XCTestCase {
    func testEveryPaletteColourSurvivesHexRoundTrip() {
        for hex in Color.colorArray {
            let roundTripped = Color(hex: hex).toHex()
            XCTAssertEqual(
                roundTripped,
                hex,
                "Palette colour \(hex) round-tripped to \(roundTripped ?? "nil")"
            )
        }
    }

    func testRoundTripIsStableAcrossRepeatedConversions() {
        for hex in Color.colorArray {
            var current = hex
            for _ in 0 ..< 3 {
                guard let next = Color(hex: current).toHex() else {
                    return XCTFail("Palette colour \(hex) produced a nil hex")
                }
                current = next
            }
            XCTAssertEqual(current, hex, "Palette colour \(hex) drifted to \(current) after repeated conversions")
        }
    }
}
