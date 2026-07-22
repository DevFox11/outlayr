//
//  LedgerMarkView.swift
//  Outlayr
//

import SwiftUI

/// An empty ledger page, drawn rather than shipped: hairline rules, a column
/// gutter, and the single line an entry would land on. Grid has no illustration
/// vocabulary, so the empty state uses the same marks the populated screen does.
struct LedgerMarkView: View {
    @ScaledMetric(relativeTo: .largeTitle) private var side: CGFloat = 88

    var body: some View {
        Canvas { context, size in
            let rule = Color.Outline
            let inset: CGFloat = 0.5
            let page = CGRect(origin: .zero, size: size).insetBy(dx: inset, dy: inset)

            context.stroke(
                Path(roundedRect: page, cornerRadius: size.width * 0.09),
                with: .color(rule),
                lineWidth: 1
            )

            let rows = 4
            let top = page.minY + page.height * 0.26
            let spacing = (page.maxY - top) / CGFloat(rows)
            let gutter = page.minX + page.width * 0.28

            var lines = Path()
            for row in 0 ..< rows {
                let y = top + spacing * CGFloat(row)
                lines.move(to: CGPoint(x: page.minX, y: y))
                lines.addLine(to: CGPoint(x: page.maxX, y: y))
            }
            lines.move(to: CGPoint(x: gutter, y: top))
            lines.addLine(to: CGPoint(x: gutter, y: page.maxY))
            context.stroke(lines, with: .color(rule), lineWidth: 1)

            // The one entry the page is waiting for.
            let entryY = top + spacing * 2.5
            var entry = Path()
            entry.move(to: CGPoint(x: gutter + page.width * 0.1, y: entryY))
            entry.addLine(to: CGPoint(x: page.maxX - page.width * 0.1, y: entryY))
            context.stroke(
                entry,
                with: .color(Color.PrimaryText),
                style: StrokeStyle(lineWidth: 2, lineCap: .round)
            )
        }
        .frame(width: side, height: side)
        .accessibilityHidden(true)
    }
}
