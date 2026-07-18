//
//  BudgetEmptyStateView.swift
//  Outlayr
//

import SwiftUI
import ConfettiSwiftUI

/// The empty state for the Budgets tab: a hand-drawn glass savings jar with a
/// coin that drops in on a gentle loop, a soft animated glow, and a confetti
/// payoff when the user starts their first budget.
struct BudgetEmptyStateView: View {
    var onCreate: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var confettiCounter = 0

    private let gold = LinearGradient(
        colors: [Color(red: 1.0, green: 0.86, blue: 0.42), Color(red: 0.93, green: 0.66, blue: 0.20)],
        startPoint: .top,
        endPoint: .bottom
    )

    var body: some View {
        VStack(spacing: 26) {
            jar
                .frame(width: 168, height: 210)
                .accessibilityHidden(true)

            VStack(spacing: 6) {
                Text("No Budgets Found")
                    .font(.system(.title2, design: .rounded).weight(.semibold))
                    .foregroundStyle(Color.PrimaryText)

                Text("Create one and watch your savings jar fill up.")
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

    // MARK: - Jar

    private var jar: some View {
        GeometryReader { proxy in
            let w = proxy.size.width
            let h = proxy.size.height

            ZStack {
                Ellipse()
                    .fill(Color.PrimaryText.opacity(0.06))
                    .frame(width: w * 0.68, height: 13)
                    .blur(radius: 7)
                    .position(x: w / 2, y: h * 0.99)

                JarShape()
                    .fill(
                        LinearGradient(
                            colors: [Color.SubtitleText.opacity(0.12), Color.SubtitleText.opacity(0.045)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .shadow(color: Color.PrimaryText.opacity(0.06), radius: 12, y: 5)

                coinPile(width: w, height: h)

                if reduceMotion {
                    coin
                        .frame(width: w * 0.34)
                        .position(x: w / 2, y: h * 0.62)
                } else {
                    fallingCoin(width: w, height: h)
                }

                JarShape()
                    .stroke(Color.SubtitleText.opacity(0.30), lineWidth: 1.6)

                Ellipse()
                    .stroke(Color.SubtitleText.opacity(0.30), lineWidth: 1.6)
                    .frame(width: w * 0.58, height: w * 0.10)
                    .position(x: w / 2, y: h * 0.035)

                Capsule()
                    .fill(Color.white.opacity(0.5))
                    .frame(width: w * 0.05, height: h * 0.42)
                    .blur(radius: 3)
                    .rotationEffect(.degrees(9))
                    .position(x: w * 0.33, y: h * 0.52)
            }
        }
    }

    private func coinPile(width w: CGFloat, height h: CGFloat) -> some View {
        ZStack {
            ForEach(0..<3, id: \.self) { i in
                Ellipse()
                    .fill(gold)
                    .overlay(Ellipse().stroke(Color.black.opacity(0.08), lineWidth: 0.5))
                    .frame(width: w * (0.5 - CGFloat(i) * 0.05), height: 12)
                    .position(x: w / 2 + (i % 2 == 0 ? -3 : 3), y: h * 0.86 - CGFloat(i) * 8)
            }
        }
    }

    private var coin: some View {
        ZStack {
            Circle().fill(gold)
            Circle().stroke(Color.white.opacity(0.5), lineWidth: 1)
            Text("$")
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .foregroundStyle(Color(red: 0.55, green: 0.36, blue: 0.05))
        }
        .aspectRatio(1, contentMode: .fit)
        .shadow(color: .black.opacity(0.15), radius: 2, y: 1)
    }

    private func fallingCoin(width w: CGFloat, height h: CGFloat) -> some View {
        PhaseAnimator(CoinDrop.allCases) { phase in
            coin
                .frame(width: w * 0.34)
                .scaleEffect(x: 2 - phase.squash, y: phase.squash, anchor: .bottom)
                .opacity(phase.opacity)
                .position(x: w / 2, y: h * phase.yFraction)
        } animation: { phase in
            phase.animation
        }
    }
}

/// The looping stages of the coin dropping into the jar. `absorb -> hidden`
/// wraps around while the coin is fully transparent, so the reset is invisible.
private enum CoinDrop: CaseIterable {
    case hidden, appear, drop, settle, absorb

    var yFraction: CGFloat {
        switch self {
        case .hidden, .appear: return 0.14
        case .drop, .settle, .absorb: return 0.62
        }
    }

    var opacity: Double {
        switch self {
        case .hidden, .absorb: return 0
        case .appear, .drop, .settle: return 1
        }
    }

    var squash: CGFloat {
        self == .drop ? 0.72 : 1
    }

    var animation: Animation {
        switch self {
        case .hidden: return .linear(duration: 0.01)
        case .appear: return .easeIn(duration: 0.25)
        case .drop: return .easeIn(duration: 0.5)
        case .settle: return .spring(response: 0.34, dampingFraction: 0.45)
        case .absorb: return .easeOut(duration: 0.45).delay(0.7)
        }
    }
}

/// A mason-jar silhouette: narrow mouth, flared shoulders, straight sides, rounded base.
struct JarShape: Shape {
    func path(in rect: CGRect) -> Path {
        let w = rect.width
        let h = rect.height
        let cx = rect.midX

        let neckW = w * 0.58
        let neckTopY = h * 0.02
        let neckBottomY = h * 0.12
        let shoulderY = h * 0.27
        let corner = min(w, h) * 0.14
        let bottomY = h

        let leftNeck = cx - neckW / 2
        let rightNeck = cx + neckW / 2

        var p = Path()
        p.move(to: CGPoint(x: leftNeck, y: neckTopY))
        p.addLine(to: CGPoint(x: rightNeck, y: neckTopY))
        p.addLine(to: CGPoint(x: rightNeck, y: neckBottomY))
        p.addQuadCurve(
            to: CGPoint(x: w, y: shoulderY),
            control: CGPoint(x: rightNeck + (w - rightNeck) * 0.6, y: neckBottomY)
        )
        p.addLine(to: CGPoint(x: w, y: bottomY - corner))
        p.addQuadCurve(to: CGPoint(x: w - corner, y: bottomY), control: CGPoint(x: w, y: bottomY))
        p.addLine(to: CGPoint(x: corner, y: bottomY))
        p.addQuadCurve(to: CGPoint(x: 0, y: bottomY - corner), control: CGPoint(x: 0, y: bottomY))
        p.addLine(to: CGPoint(x: 0, y: shoulderY))
        p.addQuadCurve(
            to: CGPoint(x: leftNeck, y: neckBottomY),
            control: CGPoint(x: leftNeck * 0.4, y: neckBottomY)
        )
        p.addLine(to: CGPoint(x: leftNeck, y: neckTopY))
        p.closeSubpath()
        return p
    }
}
