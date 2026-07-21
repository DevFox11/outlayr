//
//  SpectrumHint.swift
//  Outlayr
//
//  The transaction identity hero: a photo renders as a 90pt avatar circle with
//  a hairline ring; an emoji or icon keeps the 90pt rounded-20 tile with the
//  0.22 tint wash from categories. The empty state borrows the app's ghost-tile
//  dialect but circular and transaction-specific — a dashed ring, sparkles, a
//  faint spinning spectrum ring hinting at the auto-colour detection, and a "+"
//  badge inviting a logo.
//

import SwiftUI
import UIKit

/// The conic spectrum used by the auto-colour hints — the empty hero's spinning
/// ring and the picker's Auto-detected swatch — so both read as one thing and
/// can't drift. Six stops wrapping red → red for a seamless sweep.
enum SpectrumHint {
    static let colors: [Color] = [
        Color(hex: "#FF4444"), Color(hex: "#FFBB00"), Color(hex: "#33CC66"),
        Color(hex: "#0099FF"), Color(hex: "#AA44FF"), Color(hex: "#FF4444")
    ]
}
