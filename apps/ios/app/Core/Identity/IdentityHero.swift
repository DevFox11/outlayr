//
//  IdentityHero.swift
//  Outlayr
//
//  The reusable identity-sheet surface: the ambient glow curtain, the fixed
//  floating hero, and the nested icon/emoji picker. Extracted from
//  CategoryAlerts.swift so the transaction identity sheet can reuse the same
//  hero geometry, curtain motion, and picker chrome.
//

import SwiftUI

enum IdentityHero {
    /// Reference sizes: 90pt at rest in the header, 164pt floating over the picker.
    static let expandedSize: CGFloat = 164
    static var scale: CGFloat { expandedSize / CategoryIconTile.Size.large.tile }
    static let pickerHeight: CGFloat = 430
    static let motion = Animation.spring(response: 0.4, dampingFraction: 0.85)
    static let topPadding: CGFloat = 24
    static let bottomPadding: CGFloat = 28
    /// The empty state's caption hangs below the tile, so the header needs
    /// extra room before the first card while it is showing.
    static let captionClearance: CGFloat = 24
    static var restingCenterY: CGFloat { topPadding + CategoryIconTile.Size.large.tile / 2 }
}
