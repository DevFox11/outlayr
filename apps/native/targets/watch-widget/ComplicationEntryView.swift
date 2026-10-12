import SwiftUI
import WidgetKit

struct ComplicationEntryView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.widgetRenderingMode) private var renderingMode

    let entry: ComplicationEntry

    private static let overColor = Color(red: 0.945, green: 0.471, blue: 0.475)

    private var snapshot: ComplicationSnapshot { entry.snapshot ?? .sample }
    private var budget: ComplicationSnapshot.Budget? { snapshot.activeBudget(at: entry.date) }

    private var remainingColor: Color {
        guard renderingMode == .fullColor, budget?.over == true else { return .primary }
        return Self.overColor
    }

    var body: some View {
        Group {
            switch family {
            case .accessoryCircular:
                circular
            case .accessoryRectangular:
                rectangular
            case .accessoryCorner:
                corner
            default:
                inline
            }
        }
        .redacted(reason: entry.snapshot == nil ? .placeholder : [])
        .containerBackground(for: .widget) { Color.clear }
    }

    private var circular: some View {
        ZStack {
            AccessoryWidgetBackground()
            if let budget {
                Circle()
                    .stroke(Color.primary.opacity(0.2), lineWidth: 2.5)
                Circle()
                    .trim(from: 0, to: budget.spent)
                    .stroke(style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .widgetAccentable()
                figureStack(budget.remaining, budget.remainingCaption, color: remainingColor)
            } else {
                figureStack(snapshot.todaySpent, snapshot.todayLabel, color: .primary)
            }
        }
        .padding(1.5)
    }

    private var rectangular: some View {
        VStack(alignment: .leading, spacing: 3) {
            row(snapshot.todayLabel, snapshot.todaySpent, color: .primary, accent: budget == nil)
            if let budget {
                row(budget.remainingCaption, budget.remaining, color: remainingColor, accent: true)
                paceBar(budget)
            } else if let days = snapshot.week?.days, !days.isEmpty {
                weekBars(days.map(\.value))
            }
        }
    }

    private func weekBars(_ values: [Double]) -> some View {
        let peak = max(values.max() ?? 0, 0.01)
        return HStack(alignment: .bottom, spacing: 3) {
            ForEach(Array(values.enumerated()), id: \.offset) { index, value in
                let today = index == values.count - 1
                Rectangle()
                    .fill(Color.primary.opacity(today ? 1 : 0.35))
                    .frame(height: max(16 * value / peak, 1))
                    .frame(maxWidth: .infinity)
                    .widgetAccentable(today)
            }
        }
        .frame(height: 16, alignment: .bottom)
    }

    @ViewBuilder
    private var corner: some View {
        if let budget {
            figure(budget.remaining, size: 15, color: remainingColor)
                .widgetAccentable()
                .widgetLabel {
                    Gauge(value: budget.spent) {
                        Text(budget.remainingCaption)
                    }
                    .gaugeStyle(.accessoryLinearCapacity)
                }
        } else {
            figure(snapshot.todaySpent, size: 15, color: .primary)
                .widgetAccentable()
                .widgetLabel {
                    Text(snapshot.todayLabel)
                }
        }
    }

    @ViewBuilder
    private var inline: some View {
        if let budget {
            Text("\(snapshot.todaySpent) \(snapshot.todayLabel) · \(budget.remaining) \(budget.remainingCaption)")
                .monospacedDigit()
        } else {
            Text("\(snapshot.todaySpent) \(snapshot.todayLabel)")
                .monospacedDigit()
        }
    }

    private func figure(_ text: String, size: CGFloat, color: Color) -> some View {
        Text(text)
            .font(.system(size: size, weight: .semibold, design: .monospaced))
            .monospacedDigit()
            .foregroundStyle(color)
            .lineLimit(1)
            .minimumScaleFactor(0.6)
    }

    private func label(_ text: String, size: CGFloat, tracking: CGFloat) -> some View {
        Text(text)
            .font(.system(size: size, weight: .medium, design: .monospaced))
            .tracking(tracking)
            .foregroundStyle(.secondary)
            .lineLimit(1)
    }

    private func figureStack(_ value: String, _ caption: String, color: Color) -> some View {
        VStack(spacing: 1) {
            figure(value, size: 15, color: color)
                .widgetAccentable()
            label(caption, size: 8, tracking: 1)
        }
        .padding(.horizontal, 6)
    }

    private func row(_ labelText: String, _ value: String, color: Color, accent: Bool) -> some View {
        HStack(alignment: .firstTextBaseline) {
            label(labelText, size: 9, tracking: 1.2)
            Spacer(minLength: 4)
            figure(value, size: 14, color: color)
                .widgetAccentable(accent)
        }
    }

    private func paceBar(_ budget: ComplicationSnapshot.Budget) -> some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Rectangle()
                    .fill(Color.primary.opacity(0.2))
                    .frame(height: 1)
                Rectangle()
                    .fill(Color.primary)
                    .frame(width: geometry.size.width * budget.spent, height: 1)
                    .widgetAccentable()
                Rectangle()
                    .fill(Color.primary)
                    .frame(width: 1, height: 6)
                    .offset(x: geometry.size.width * budget.elapsed - 0.5)
            }
            .frame(maxHeight: .infinity)
        }
        .frame(height: 6)
    }
}

struct LogComplicationView: View {
    @Environment(\.widgetFamily) private var family

    var body: some View {
        Group {
            if family == .accessoryCorner {
                Image(systemName: "plus")
                    .font(.system(size: 22, weight: .semibold))
                    .widgetAccentable()
            } else {
                ZStack {
                    AccessoryWidgetBackground()
                    Image(systemName: "plus")
                        .font(.system(size: 24, weight: .semibold))
                        .widgetAccentable()
                }
            }
        }
        .widgetURL(URL(string: "outlayr-watch://log"))
        .containerBackground(for: .widget) { Color.clear }
    }
}
