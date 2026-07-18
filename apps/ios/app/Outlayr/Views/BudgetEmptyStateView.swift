//
//  BudgetEmptyStateView.swift
//  Outlayr
//

import SwiftUI
import ConfettiSwiftUI

/// The empty state for the Budgets tab: a soft, line-art "ghost" preview of a
/// budget card — a faded wireframe of the real gauge the user is about to
/// create — plus a call to action that celebrates their first budget.
struct BudgetEmptyStateView: View {
    var onCreate: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var confettiCounter = 0

    private var stroke: Color { Color.SubtitleText.opacity(0.32) }
    private var softFill: Color { Color.SubtitleText.opacity(0.12) }
    private var trackFill: Color { Color.SubtitleText.opacity(0.10) }
    private var cardFill: Color { Color.SubtitleText.opacity(0.05) }
    private var accent: Color { Color.IncomeGreen.opacity(0.22) }

    var body: some View {
        VStack(spacing: 26) {
            ghostCard
                .frame(width: 232, height: 176)
                .accessibilityHidden(true)

            VStack(spacing: 6) {
                Text("No Budgets Found")
                    .font(.system(.title2, design: .rounded).weight(.semibold))
                    .foregroundStyle(Color.PrimaryText)

                Text("Set a budget and track your spending at a glance.")
                    .font(.system(.subheadline, design: .rounded).weight(.medium))
                    .foregroundStyle(Color.SubtitleText)
                    .multilineTextAlignment(.center)
            }

            Button(action: create) {
                Text("Create a Budget")
                    .font(.system(.body, design: .rounded).weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.vertical, 13)
                    .padding(.horizontal, 28)
                    .background(Color.IncomeGreen, in: Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .confettiCannon(
            counter: $confettiCounter,
            num: 24,
            confettis: [.text("💵"), .text("🪙"), .text("💰"), .text("💶")],
            confettiSize: 24,
            radius: 320
        )
    }

    private func create() {
        if !reduceMotion { confettiCounter += 1 }
        onCreate()
    }

    // MARK: - Ghost budget card

    private var ghostCard: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(cardFill)
                .overlay(
                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .stroke(stroke, lineWidth: 1.8)
                )
                .shadow(color: Color.PrimaryText.opacity(0.05), radius: 12, y: 5)

            VStack(spacing: 14) {
                gauge
                legend
            }
            .padding(22)

            sparkles
        }
    }

    private var gauge: some View {
        ZStack {
            DonutSemicircle(percent: 1, cornerRadius: 6, width: 20)
                .fill(trackFill)
                .frame(width: 150, height: 75)

            DonutSemicircle(percent: 0.62, cornerRadius: 6, width: 20)
                .fill(accent)
                .frame(width: 150, height: 75)

            VStack(spacing: 5) {
                Capsule().fill(softFill).frame(width: 62, height: 15)
                Capsule().fill(softFill).frame(width: 38, height: 7)
            }
            .offset(y: 8)
        }
        .frame(width: 150, height: 75)
    }

    private var legend: some View {
        HStack {
            Capsule().fill(softFill).frame(width: 46, height: 7)
            Spacer()
            Capsule().fill(softFill).frame(width: 46, height: 7)
        }
        .frame(width: 150)
    }

    private var sparkles: some View {
        ZStack {
            sparkle(size: 13).offset(x: -104, y: -66)
            sparkle(size: 9).offset(x: 108, y: -44)
            sparkle(size: 10).offset(x: 96, y: 68)
        }
        .foregroundStyle(Color.SubtitleText.opacity(0.45))
    }

    private func sparkle(size: CGFloat) -> some View {
        Image(systemName: "sparkle")
            .font(.system(size: size))
    }
}
