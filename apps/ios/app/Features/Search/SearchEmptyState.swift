//
//  SearchEmptyState.swift
//  Outlayr
//

import SwiftUI

struct SearchEmptyState: View {
    enum Kind: Equatable {
        case idle
        case noResults(query: String)
    }

    let kind: Kind

    private var title: String {
        switch kind {
        case .idle: String(localized: "Search your ledger")
        case .noResults: String(localized: "No matches")
        }
    }

    private var subtitle: String {
        switch kind {
        case .idle:
            String(localized: "Find an entry by its note, category, or amount.")
        case let .noResults(query):
            String(localized: "No entry matches \u{201C}\(query)\u{201D}.")
        }
    }

    var body: some View {
        VStack(spacing: 14) {
            mark
                .padding(.bottom, 6)

            Text(verbatim: title)
                .font(.system(.title3, design: .rounded).weight(.semibold))
                .foregroundStyle(Color.PrimaryText)
                .multilineTextAlignment(.center)

            Text(verbatim: subtitle)
                .font(.system(.subheadline, design: .rounded).weight(.medium))
                .foregroundStyle(Color.SubtitleText)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 280)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 32)
        .padding(.top, 80)
    }

    @ViewBuilder
    private var mark: some View {
        switch kind {
        case .idle:
            SearchIdleMark()
        case .noResults:
            SearchNoResultsMark()
        }
    }
}

/// A large magnifier held over the ledger — the promise of what search will
/// surface. Five hairline rows are visible through the glass; the faint middle
/// stroke is the ghost of an entry waiting to be found.
private struct SearchIdleMark: View {
    @ScaledMetric(relativeTo: .largeTitle) private var side: CGFloat = 120

    var body: some View {
        Canvas { context, size in
            let rule = Color.Outline
            let ink = Color.PrimaryText
            let w = size.width
            let h = size.height

            let lensCenter = CGPoint(x: w * 0.42, y: h * 0.40)
            let lensRadius = w * 0.34
            let lensRect = CGRect(
                x: lensCenter.x - lensRadius,
                y: lensCenter.y - lensRadius,
                width: lensRadius * 2,
                height: lensRadius * 2
            )

            // Subtle glass tint so the lens reads as a surface
            context.fill(Path(ellipseIn: lensRect), with: .color(ink.opacity(0.04)))

            // Ledger rows and gutter, clipped inside the lens
            var glass = context
            glass.clip(to: Path(ellipseIn: lensRect))

            let rowCount = 5
            let rowTop = lensCenter.y - lensRadius * 0.78
            let rowBottom = lensCenter.y + lensRadius * 0.78
            let rowGap = (rowBottom - rowTop) / CGFloat(rowCount - 1)
            let gutterX = lensCenter.x - lensRadius * 0.30

            var rows = Path()
            for i in 0 ..< rowCount {
                let y = rowTop + rowGap * CGFloat(i)
                rows.move(to: CGPoint(x: lensCenter.x - lensRadius, y: y))
                rows.addLine(to: CGPoint(x: lensCenter.x + lensRadius, y: y))
            }
            rows.move(to: CGPoint(x: gutterX, y: lensCenter.y - lensRadius))
            rows.addLine(to: CGPoint(x: gutterX, y: lensCenter.y + lensRadius))
            glass.stroke(rows, with: .color(rule), lineWidth: 1)

            // Ghost entry centred on the middle row — the find waiting to happen
            let midY = rowTop + rowGap * 2
            var entry = Path()
            entry.move(to: CGPoint(x: gutterX + lensRadius * 0.14, y: midY))
            entry.addLine(to: CGPoint(x: lensCenter.x + lensRadius * 0.68, y: midY))
            glass.stroke(entry, with: .color(ink.opacity(0.42)), style: StrokeStyle(lineWidth: 2, lineCap: .round))

            // Lens rim — the one solid accent
            context.stroke(Path(ellipseIn: lensRect), with: .color(ink), lineWidth: 2.5)

            // Handle
            let diagonal = CGPoint(x: 0.707, y: 0.707)
            var handle = Path()
            handle.move(to: CGPoint(
                x: lensCenter.x + diagonal.x * lensRadius,
                y: lensCenter.y + diagonal.y * lensRadius
            ))
            handle.addLine(to: CGPoint(x: w * 0.91, y: h * 0.91))
            context.stroke(handle, with: .color(ink), style: StrokeStyle(lineWidth: 3.5, lineCap: .round))
        }
        .frame(width: side, height: side)
        .accessibilityHidden(true)
    }
}

/// The same ledger page searched — but with a single diagonal strike through
/// it. The page structure is immediately recognisable; the diagonal is the one
/// mark that says there is nothing to find here.
private struct SearchNoResultsMark: View {
    @ScaledMetric(relativeTo: .largeTitle) private var side: CGFloat = 96

    var body: some View {
        Canvas { context, size in
            let rule = Color.Outline
            let ink = Color.PrimaryText
            let inset: CGFloat = 0.5
            let page = CGRect(origin: .zero, size: size).insetBy(dx: inset, dy: inset)

            // Page outline
            context.stroke(
                Path(roundedRect: page, cornerRadius: size.width * 0.09),
                with: .color(rule),
                lineWidth: 1
            )

            // Hairline rows and gutter
            let rowCount = 4
            let top = page.minY + page.height * 0.26
            let spacing = (page.maxY - top) / CGFloat(rowCount)
            let gutter = page.minX + page.width * 0.28

            var lines = Path()
            for row in 0 ..< rowCount {
                let y = top + spacing * CGFloat(row)
                lines.move(to: CGPoint(x: page.minX, y: y))
                lines.addLine(to: CGPoint(x: page.maxX, y: y))
            }
            lines.move(to: CGPoint(x: gutter, y: top))
            lines.addLine(to: CGPoint(x: gutter, y: page.maxY))
            context.stroke(lines, with: .color(rule), lineWidth: 1)

            // Diagonal strike — the single bold accent that means "not found"
            let pad = page.width * 0.10
            var strike = Path()
            strike.move(to: CGPoint(x: page.minX + pad, y: page.minY + pad))
            strike.addLine(to: CGPoint(x: page.maxX - pad, y: page.maxY - pad))
            context.stroke(strike, with: .color(ink), style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
        }
        .frame(width: side, height: side)
        .accessibilityHidden(true)
    }
}
