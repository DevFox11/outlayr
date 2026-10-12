import Combine
import SwiftUI

struct TodayView: View {
    let snapshot: WatchSnapshot
    let unsynced: [WatchWrite]
    @Environment(\.isLuminanceReduced) private var dimmed
    @State private var day = Date()

    private struct DayGroup: Identifiable {
        let header: String?
        var entries: [WatchSnapshot.Entry]
        var id: String { header ?? "" }
    }

    var body: some View {
        let fresh = snapshot.isFromToday
        let now = Date().timeIntervalSince1970 * 1000
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Kicker(fresh ? "\(snapshot.todayLabel) · \(snapshot.dateLabel)" : snapshot.todayLabel)
                Text(total(fresh: fresh))
                    .font(Grid.mono(40, medium: true))
                    .foregroundStyle(Grid.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                    .contentTransition(.numericText())
                    .privacySensitive()
                if snapshot.budget.isCurrent(at: now) {
                    BudgetBlock(
                        budget: snapshot.budget,
                        elapsed: snapshot.budget.elapsed(at: now, publishedAt: snapshot.publishedAt),
                        spent: snapshot.labels.spent
                    )
                } else if !snapshot.budget.present, fresh, let week = snapshot.week {
                    WeekBars(
                        week: week.addingToday(pendingToday),
                        title: snapshot.labels.week ?? "",
                        average: snapshot.labels.average ?? ""
                    )
                }
                entries
            }
            .padding(.horizontal, 6)
            .animation(.snappy, value: snapshot.todaySpent)
            .animation(.snappy, value: unsynced.map(\.id))
        }
        .redacted(reason: dimmed ? .privacy : [])
        .id(Calendar.current.startOfDay(for: day))
        .onReceive(NotificationCenter.default.publisher(for: .NSCalendarDayChanged).receive(on: RunLoop.main)) { _ in
            day = Date()
        }
    }

    private var pendingToday: Double {
        unsynced
            .filter { !$0.income && Calendar.current.isDateInToday(Date(timeIntervalSince1970: $0.date / 1000)) }
            .reduce(0) { $0 + $1.amount }
    }

    private func total(fresh: Bool) -> String {
        let pending = pendingToday
        guard pending > 0, let base = fresh ? snapshot.week?.days.last?.value : 0 else {
            return fresh ? snapshot.todaySpent : snapshot.zeroSpent
        }
        return snapshot.money.format(units: Int(((base + pending) * Double(snapshot.money.scale)).rounded()))
    }

    @ViewBuilder
    private var entries: some View {
        if unsynced.isEmpty, snapshot.entries.isEmpty {
            Text(snapshot.labels.empty)
                .font(.system(size: 15))
                .foregroundStyle(Grid.muted)
                .padding(.top, 4)
        }
        VStack(alignment: .leading, spacing: 0) {
            if !unsynced.isEmpty || !snapshot.entries.isEmpty {
                Hairline()
            }
            ForEach(Array(unsynced.enumerated()), id: \.element.id) { index, write in
                EntryRow(
                    emoji: category(write.categoryId)?.emoji ?? "",
                    color: category(write.categoryId)?.color ?? "",
                    title: write.category,
                    amount: snapshot.money.format(units: Int((write.amount * Double(snapshot.money.scale)).rounded())),
                    income: write.income,
                    latest: index == 0
                )
            }
            ForEach(groups) { group in
                if let header = group.header {
                    Kicker(header).padding(.top, 10).padding(.bottom, 2)
                }
                ForEach(group.entries) { entry in
                    EntryRow(
                        emoji: entry.emoji,
                        color: entry.color,
                        title: entry.note.isEmpty ? entry.category ?? "" : entry.note,
                        amount: entry.amount,
                        income: entry.income,
                        latest: false
                    )
                }
            }
        }
        .padding(.top, 4)
    }

    private func category(_ id: String) -> WatchSnapshot.Category? {
        snapshot.categories.first { $0.id == id }
    }

    private func dayHeader(_ entry: WatchSnapshot.Entry) -> String? {
        guard let at = entry.at else { return entry.day }
        let date = Date(timeIntervalSince1970: at / 1000)
        if Calendar.current.isDateInToday(date) { return nil }
        if Calendar.current.isDateInYesterday(date) { return snapshot.labels.yesterday ?? entry.day }
        return entry.date ?? entry.day
    }

    private var groups: [DayGroup] {
        var result: [DayGroup] = []
        for entry in snapshot.entries {
            let header = dayHeader(entry)
            if let last = result.last, last.header == header {
                result[result.count - 1].entries.append(entry)
            } else {
                result.append(DayGroup(header: header, entries: [entry]))
            }
        }
        return result
    }
}

struct BudgetBlock: View {
    let budget: WatchSnapshot.Budget
    let elapsed: Double
    let spent: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(budget.remaining)
                    .font(Grid.mono(24))
                    .foregroundStyle(budget.over ? Grid.over : Grid.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .privacySensitive()
                Kicker(budget.remainingCaption)
            }
            PaceBar(spent: budget.spentFraction, elapsed: elapsed, over: budget.over)
            Kicker("\(budget.percent) \(spent) · \(budget.isOverall ? budget.periodLabel : budget.name)")
        }
        .padding(.vertical, 4)
    }
}

struct WeekBars: View {
    let week: WatchSnapshot.Week
    let title: String
    let average: String

    private let height: CGFloat = 42

    private var peak: Double {
        max(week.days.map(\.value).max() ?? 0, 0.01)
    }

    private var mean: Double {
        week.days.isEmpty ? 0 : week.days.map(\.value).reduce(0, +) / Double(week.days.count)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(alignment: .firstTextBaseline) {
                Kicker(title)
                Spacer(minLength: 4)
                Kicker("\(average) \(week.average)").privacySensitive()
            }
            HStack(alignment: .bottom, spacing: 5) {
                ForEach(Array(week.days.enumerated()), id: \.offset) { index, day in
                    UnevenRoundedRectangle(topLeadingRadius: 2, topTrailingRadius: 2)
                        .fill(index == week.days.count - 1 ? Grid.ink : Grid.bar)
                        .frame(height: max(height * day.value / peak, 2))
                        .frame(maxWidth: .infinity)
                }
            }
            .frame(height: height, alignment: .bottom)
            .overlay(alignment: .bottom) {
                Line()
                    .stroke(Grid.ghost, style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                    .frame(height: 1)
                    .offset(y: -height * mean / peak)
            }
            Hairline()
            HStack(spacing: 5) {
                ForEach(Array(week.days.enumerated()), id: \.offset) { index, day in
                    Text(day.label)
                        .font(Grid.mono(10))
                        .foregroundStyle(index == week.days.count - 1 ? Grid.ink : Grid.muted)
                        .frame(maxWidth: .infinity)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

private struct Line: Shape {
    func path(in rect: CGRect) -> Path {
        Path { path in
            path.move(to: CGPoint(x: rect.minX, y: rect.midY))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        }
    }
}

struct PaceBar: View {
    let spent: Double
    let elapsed: Double
    let over: Bool

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Rectangle().fill(Grid.hairline).frame(height: 2)
                Rectangle()
                    .fill(over ? Grid.over : Grid.ink)
                    .frame(width: geo.size.width * clamp(spent), height: 2)
                Rectangle()
                    .fill(Grid.accent)
                    .frame(width: 2, height: 8)
                    .offset(x: geo.size.width * clamp(elapsed) - 1)
            }
            .frame(height: 8)
        }
        .frame(height: 8)
    }

    private func clamp(_ value: Double) -> Double {
        min(max(value, 0), 1)
    }
}
