import SwiftUI

struct RecentView: View {
    let snapshot: WatchSnapshot

    private struct DayGroup: Identifiable {
        let day: String
        var entries: [WatchSnapshot.Entry]
        var id: String { day }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                Kicker(snapshot.labels.recent, color: Grid.ink)
                if snapshot.entries.isEmpty {
                    Text(snapshot.labels.empty)
                        .font(.system(size: 15))
                        .foregroundStyle(Grid.muted)
                        .padding(.top, 8)
                }
                ForEach(groups) { group in
                    Kicker(group.day).padding(.top, 8)
                    ForEach(group.entries) { entry in
                        EntryRow(entry: entry)
                    }
                }
            }
            .padding(.horizontal, 6)
        }
    }

    private var groups: [DayGroup] {
        var result: [DayGroup] = []
        for entry in snapshot.entries {
            if result.last?.day == entry.day {
                result[result.count - 1].entries.append(entry)
            } else {
                result.append(DayGroup(day: entry.day, entries: [entry]))
            }
        }
        return result
    }
}
