//
//  NavigationSubtitleModifier.swift
//  Outlayr
//

import SwiftUI

/// `navigationSubtitle` shipped in iOS 26; Outlayr still deploys to iOS 17,
/// where the title simply stands alone rather than the screen growing a
/// hand-rolled substitute for chrome the system owns.
struct NavigationSubtitleModifier: ViewModifier {
    let subtitle: String

    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.navigationSubtitle(subtitle)
        } else {
            content
        }
    }
}

extension View {
    func navigationSubtitleIfAvailable(_ subtitle: String) -> some View {
        modifier(NavigationSubtitleModifier(subtitle: subtitle))
    }
}
