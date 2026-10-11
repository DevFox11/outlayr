import SwiftUI

struct TodayView: View {
    let snapshot: WatchSnapshot

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Kicker("\(snapshot.todayLabel) · \(snapshot.dateLabel)")
                Text(snapshot.todaySpent)
                    .font(Grid.mono(40, medium: true))
                    .foregroundStyle(Grid.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                    .contentTransition(.numericText())
                Hairline()
                if snapshot.budget.present {
                    BudgetBlock(budget: snapshot.budget, spent: snapshot.labels.spent)
                }
                ForEach(snapshot.entries.prefix(2)) { entry in
                    EntryRow(entry: entry)
                }
            }
            .padding(.horizontal, 6)
            .animation(.snappy, value: snapshot.todaySpent)
        }
    }
}

struct BudgetBlock: View {
    let budget: WatchSnapshot.Budget
    let spent: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(budget.remaining)
                    .font(Grid.mono(24))
                    .foregroundStyle(budget.over ? Grid.over : Grid.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                Kicker(budget.remainingCaption)
            }
            PaceBar(spent: budget.spentFraction, elapsed: budget.elapsedFraction, over: budget.over)
            Kicker("\(budget.percent) \(spent) · \(budget.isOverall ? budget.periodLabel : budget.name)")
            Hairline()
        }
        .padding(.vertical, 4)
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
