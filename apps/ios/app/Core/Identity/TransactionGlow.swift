//
//  TransactionGlow.swift
//  Outlayr
//
//  The ambient glow curtain shared by the identity sheets, and the pure hue
//  derivation behind it. Mirrors the treatment inlined in CategorySheetSurface:
//  three pastel hues morphing across the top 260pt, hues frozen (never animate),
//  only the vertical reveal moves. iOS 18 gets the MeshGradient; 17 the linear
//  fallback under a fade mask.
//

import SwiftUI

/// Assembles the three curtain slots a transaction's identity feeds the mesh:
/// its two dominant image hues lead, the chosen (auto or overridden) color
/// closes — `[dom1, dom2, chosen]`. A single dominant repeats into slot two; no
/// dominants and every slot is the chosen color.
enum TransactionGlow {
    static func curtainInputs(dominants: [String], chosen: String) -> [String] {
        let dom1 = dominants.first ?? chosen
        let dom2 = dominants.count > 1 ? dominants[1] : dom1
        return [dom1, dom2, chosen]
    }
}
