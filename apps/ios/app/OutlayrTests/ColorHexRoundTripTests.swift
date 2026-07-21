//
//  ColorHexRoundTripTests.swift
//  OutlayrTests
//
//  The used-color contract compares stored hex strings, so a color that does
//  not survive Color(hex:) -> toHex() unchanged would silently escape the
//  duplicate check and let two categories share a swatch.
//

import SwiftUI
import XCTest

@testable import Outlayr

final class ColorHexRoundTripTests: XCTestCase {
    func testEveryPaletteColorSurvivesHexRoundTrip() {
        for hex in Color.colorArray {
            let roundTripped = Color(hex: hex).toHex()
            XCTAssertEqual(
                roundTripped,
                hex,
                "Palette color \(hex) round-tripped to \(roundTripped ?? "nil")"
            )
        }
    }

    func testRoundTripIsStableAcrossRepeatedConversions() {
        for hex in Color.colorArray {
            var current = hex
            for _ in 0 ..< 3 {
                guard let next = Color(hex: current).toHex() else {
                    return XCTFail("Palette color \(hex) produced a nil hex")
                }
                current = next
            }
            XCTAssertEqual(current, hex, "Palette color \(hex) drifted to \(current) after repeated conversions")
        }
    }
}
