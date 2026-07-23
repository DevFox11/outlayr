//
//  SearchEmptyState.swift
//  Outlayr
//

import SwiftUI

/// The two things the search screen shows when the list is empty: before a
/// query, and after one that matched nothing. Both use the Grid empty-state
/// grammar — a hairline mark with one solid stroke, a title, and a subtitle —
/// so they read as one screen rather than two borrowed illustrations.
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
            String(localized: "No entry matches “\(query)”.")
        }
    }

    var body: some View {
        VStack(spacing: 14) {
            SearchMark(found: kind == .idle)
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
}

/// The Log's ledger page with a magnifier held over it — the app's own motif,
/// not a generic glass. The hairlines draw the page and its rows; the one solid
/// accent is the magnifier. When there is a match the framed row carries an
/// entry; when there is not, the lens sits over a blank line.
private struct SearchMark: View {
    let found: Bool

    @ScaledMetric(relativeTo: .largeTitle) private var side: CGFloat = 104

    var body: some View {
        Canvas { context, size in
            let rule = Color.Outline
            let ink = Color.PrimaryText
            let w = size.width
            let h = size.height

            let lensCenter = CGPoint(x: w * 0.42, y: h * 0.40)
            let lensRadius = w * 0.32
            let lensRect = CGRect(
                x: lensCenter.x - lensRadius,
                y: lensCenter.y - lensRadius,
                width: lensRadius * 2,
                height: lensRadius * 2
            )

            // The ledger lives inside the glass: ruled rows and a gutter, clipped
            // to the lens so they read as paper seen through it. The middle row
            // is a bold entry when there is a match, blank when there is not.
            var glass = context
            glass.clip(to: Path(ellipseIn: lensRect))

            let rowGap = lensRadius * 0.44
            let gutterX = lensCenter.x - lensRadius * 0.36
            var rules = Path()
            for offset in [-1.0, 0.0, 1.0] {
                let y = lensCenter.y + rowGap * offset
                rules.move(to: CGPoint(x: lensCenter.x - lensRadius, y: y))
                rules.addLine(to: CGPoint(x: lensCenter.x + lensRadius, y: y))
            }
            rules.move(to: CGPoint(x: gutterX, y: lensCenter.y - lensRadius))
            rules.addLine(to: CGPoint(x: gutterX, y: lensCenter.y + lensRadius))
            glass.stroke(rules, with: .color(rule), lineWidth: 1)

            if found {
                var entry = Path()
                entry.move(to: CGPoint(x: gutterX + lensRadius * 0.18, y: lensCenter.y))
                entry.addLine(to: CGPoint(x: lensCenter.x + lensRadius * 0.72, y: lensCenter.y))
                glass.stroke(entry, with: .color(ink), style: StrokeStyle(lineWidth: 2.5, lineCap: .round))

                let dotRadius = lensRadius * 0.09
                let dot = CGPoint(x: gutterX - lensRadius * 0.16, y: lensCenter.y)
                glass.fill(
                    Path(ellipseIn: CGRect(
                        x: dot.x - dotRadius, y: dot.y - dotRadius,
                        width: dotRadius * 2, height: dotRadius * 2
                    )),
                    with: .color(ink)
                )
            }

            // The rim and handle, on top, in the app's one-bold-accent grammar.
            context.stroke(Path(ellipseIn: lensRect), with: .color(ink), lineWidth: 2.5)

            let diagonal = CGPoint(x: 0.707, y: 0.707)
            var handle = Path()
            handle.move(to: CGPoint(
                x: lensCenter.x + diagonal.x * lensRadius,
                y: lensCenter.y + diagonal.y * lensRadius
            ))
            handle.addLine(to: CGPoint(x: w * 0.9, y: h * 0.9))
            context.stroke(handle, with: .color(ink), style: StrokeStyle(lineWidth: 3.5, lineCap: .round))
        }
        .frame(width: side, height: side)
        .accessibilityHidden(true)
    }
}
