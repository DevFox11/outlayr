//
//  LogEmptyStateView.swift
//  Outlayr
//

import SwiftUI

/// What a brand-new install sees. The ghost card previews the shape of a real
/// log day — a date header, a gutter divider, and three transaction rows that
/// fade to nothing — so the user knows exactly what will appear once they log
/// their first entry.
struct LogEmptyStateView: View {
    let bottomEdge: CGFloat

    private var stroke: Color { Color.SubtitleText.opacity(0.28) }
    private var softFill: Color { Color.SubtitleText.opacity(0.13) }
    private var cardFill: Color { Color.SubtitleText.opacity(0.05) }

    var body: some View {
        GeometryReader { proxy in
            ScrollView(showsIndicators: false) {
                VStack(spacing: 26) {
                    ghostCard
                        .accessibilityHidden(true)

                    VStack(spacing: 6) {
                        Text("Nothing logged yet")
                            .font(.system(.title3, design: .rounded).weight(.semibold))
                            .foregroundStyle(Color.PrimaryText)

                        Text("Your first entry sets the baseline everything else is measured against.")
                            .font(.system(.subheadline, design: .rounded).weight(.medium))
                            .foregroundStyle(Color.SubtitleText)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: 280)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 32)
                .padding(.vertical, 40)
                .frame(minHeight: max(0, proxy.size.height - (70 + bottomEdge)), alignment: .center)
            }
            .scrollBounceBehavior(.basedOnSize)
        }
    }

    private var ghostCard: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(cardFill)
                .overlay(
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                        .stroke(stroke, lineWidth: 1.5)
                )
                .shadow(color: Color.PrimaryText.opacity(0.04), radius: 12, y: 5)

            VStack(spacing: 0) {
                dayHeader
                divider(opacity: 1.0)
                ghostRow(noteWidth: 108, subWidth: 60, amountWidth: 56, opacity: 1.0)
                divider(opacity: 0.7)
                ghostRow(noteWidth: 82, subWidth: 50, amountWidth: 48, opacity: 0.55)
                divider(opacity: 0.4)
                ghostRow(noteWidth: 96, subWidth: 44, amountWidth: 62, opacity: 0.28)
            }
            .padding(.vertical, 4)

            decorativeSparkles
        }
        .frame(width: 244)
    }

    private var dayHeader: some View {
        HStack {
            Capsule().fill(softFill).frame(width: 72, height: 8)
            Spacer()
            Capsule().fill(softFill).frame(width: 44, height: 8)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 11)
    }

    private func divider(opacity: Double) -> some View {
        Rectangle()
            .fill(stroke.opacity(opacity))
            .frame(height: 1)
            .padding(.horizontal, 16)
    }

    private func ghostRow(noteWidth: CGFloat, subWidth: CGFloat, amountWidth: CGFloat, opacity: Double) -> some View {
        HStack(spacing: 10) {
            Circle()
                .fill(softFill)
                .frame(width: 34, height: 34)

            VStack(alignment: .leading, spacing: 5) {
                Capsule().fill(softFill).frame(width: noteWidth, height: 9)
                Capsule().fill(softFill).frame(width: subWidth, height: 7)
            }

            Spacer()

            Capsule().fill(softFill).frame(width: amountWidth, height: 11)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 9)
        .opacity(opacity)
    }

    private var decorativeSparkles: some View {
        ZStack {
            sparkle(size: 12).offset(x: -112, y: -80)
            sparkle(size: 8).offset(x: 112, y: -54)
            sparkle(size: 9).offset(x: 100, y: 78)
        }
        .foregroundStyle(Color.SubtitleText)
    }

    private func sparkle(size: CGFloat) -> some View {
        Image(systemName: "sparkle")
            .scaledFont(size)
    }
}
