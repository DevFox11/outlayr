//
//  LogEmptyStateView.swift
//  Outlayr
//

import SwiftUI

/// What a brand-new install sees. It carries no search field and no filter
/// button: there is nothing to search and nothing to filter, and offering
/// either would be the screen claiming content it doesn't have.
struct LogEmptyStateView: View {
    /// The tab bar is an overlay, so the copy has to be centered in the space
    /// left above it rather than in the whole screen.
    let bottomEdge: CGFloat

    var body: some View {
        GeometryReader { proxy in
            ScrollView(showsIndicators: false) {
                VStack(spacing: 14) {
                    LedgerMarkView()
                        .padding(.bottom, 6)

                    Text("Nothing logged yet")
                        .font(.system(.title3, design: .rounded).weight(.semibold))
                        .foregroundStyle(Color.PrimaryText)
                        .multilineTextAlignment(.center)

                    Text("Your first entry sets the baseline everything else is measured against.")
                        .font(.system(.subheadline, design: .rounded).weight(.medium))
                        .foregroundStyle(Color.SubtitleText)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 280)
                }
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 32)
                .padding(.vertical, 40)
                .frame(minHeight: max(0, proxy.size.height - (70 + bottomEdge)), alignment: .center)
            }
            .scrollBounceBehavior(.basedOnSize)
        }
    }
}
