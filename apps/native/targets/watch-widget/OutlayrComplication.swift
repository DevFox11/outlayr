import SwiftUI
import WidgetKit

struct ComplicationSnapshot: Decodable {
    struct Budget: Decodable {
        let present: Bool
        let remaining: String
        let remainingCaption: String
        let spentFraction: Double
        let elapsedFraction: Double
        let over: Bool

        var spent: Double { min(max(spentFraction, 0), 1) }
        var elapsed: Double { min(max(elapsedFraction, 0), 1) }
    }

    let todayLabel: String
    let todaySpent: String
    let zeroSpent: String?
    let budget: Budget?

    var atMidnight: ComplicationSnapshot {
        ComplicationSnapshot(todayLabel: todayLabel, todaySpent: zeroSpent ?? todaySpent, zeroSpent: zeroSpent, budget: budget)
    }

    var activeBudget: Budget? {
        guard let budget, budget.present else { return nil }
        return budget
    }

    static let appGroup = "group.com.tryoutlayr.app"
    static let key = "watchSnapshot"

    static func load() -> ComplicationSnapshot? {
        guard let data = UserDefaults(suiteName: appGroup)?.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(ComplicationSnapshot.self, from: data)
    }

    static let sample = ComplicationSnapshot(
        todayLabel: "TODAY",
        todaySpent: "$44.70",
        zeroSpent: "$0.00",
        budget: Budget(
            present: true,
            remaining: "$189",
            remainingCaption: "LEFT",
            spentFraction: 0.47,
            elapsedFraction: 0.35,
            over: false
        )
    )
}

struct ComplicationEntry: TimelineEntry {
    let date: Date
    let snapshot: ComplicationSnapshot?
}

struct ComplicationProvider: TimelineProvider {
    func placeholder(in context: Context) -> ComplicationEntry {
        ComplicationEntry(date: Date(), snapshot: .sample)
    }

    func getSnapshot(in context: Context, completion: @escaping (ComplicationEntry) -> Void) {
        let snapshot = context.isPreview ? ComplicationSnapshot.sample : ComplicationSnapshot.load()
        completion(ComplicationEntry(date: Date(), snapshot: snapshot))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ComplicationEntry>) -> Void) {
        let now = Date()
        let snapshot = ComplicationSnapshot.load()
        let midnight = Calendar.current.startOfDay(for: now).addingTimeInterval(24 * 60 * 60)
        completion(
            Timeline(
                entries: [
                    ComplicationEntry(date: now, snapshot: snapshot),
                    ComplicationEntry(date: midnight, snapshot: snapshot?.atMidnight),
                ],
                policy: .after(midnight)
            )
        )
    }
}

struct OutlayrComplication: Widget {
    let kind = "OutlayrComplication"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ComplicationProvider()) { entry in
            ComplicationEntryView(entry: entry)
        }
        .configurationDisplayName("Outlayr")
        .description("Today's spend and what is left in your budget.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryCorner, .accessoryInline])
    }
}

@main
struct OutlayrComplicationBundle: WidgetBundle {
    var body: some Widget {
        OutlayrComplication()
    }
}
