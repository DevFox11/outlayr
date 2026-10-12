import SwiftUI
import WidgetKit

struct ComplicationSnapshot: Decodable {
    struct Budget: Decodable {
        let present: Bool
        let endsAt: Double?
        let remaining: String
        let remainingCaption: String
        let spentFraction: Double
        let elapsedFraction: Double
        let over: Bool

        var spent: Double { min(max(spentFraction, 0), 1) }
        var elapsed: Double { min(max(elapsedFraction, 0), 1) }
    }

    struct Week: Decodable {
        struct Day: Decodable {
            let value: Double
        }

        let days: [Day]

        func shifted(by count: Int) -> Week? {
            guard count < days.count else { return nil }
            return Week(days: Array(days.dropFirst(count)) + Array(repeating: Day(value: 0), count: count))
        }
    }

    let todayLabel: String
    let todaySpent: String
    let zeroSpent: String?
    let budget: Budget?
    let week: Week?
    let publishedAt: Double?

    func asOf(_ date: Date) -> ComplicationSnapshot {
        let published = publishedAt.map { Date(timeIntervalSince1970: $0 / 1000) } ?? Date()
        let calendar = Calendar.current
        let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: published), to: calendar.startOfDay(for: date)).day ?? 0
        guard days > 0 else { return self }
        return ComplicationSnapshot(
            todayLabel: todayLabel,
            todaySpent: zeroSpent ?? todaySpent,
            zeroSpent: zeroSpent,
            budget: budget,
            week: week?.shifted(by: days),
            publishedAt: publishedAt
        )
    }

    func activeBudget(at date: Date) -> Budget? {
        guard let budget, budget.present, date.timeIntervalSince1970 * 1000 < budget.endsAt ?? .infinity else { return nil }
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
            endsAt: nil,
            remaining: "$189",
            remainingCaption: "LEFT",
            spentFraction: 0.47,
            elapsedFraction: 0.35,
            over: false
        ),
        week: nil,
        publishedAt: nil
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
        let snapshot = context.isPreview ? ComplicationSnapshot.sample : ComplicationSnapshot.load()?.asOf(Date())
        completion(ComplicationEntry(date: Date(), snapshot: snapshot))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ComplicationEntry>) -> Void) {
        let now = Date()
        let snapshot = ComplicationSnapshot.load()
        let midnight = Calendar.current.startOfDay(for: now).addingTimeInterval(24 * 60 * 60)
        completion(
            Timeline(
                entries: [
                    ComplicationEntry(date: now, snapshot: snapshot?.asOf(now)),
                    ComplicationEntry(date: midnight, snapshot: snapshot?.asOf(midnight)),
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

struct LogEntry: TimelineEntry {
    let date: Date
}

struct LogProvider: TimelineProvider {
    func placeholder(in context: Context) -> LogEntry {
        LogEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (LogEntry) -> Void) {
        completion(LogEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<LogEntry>) -> Void) {
        completion(Timeline(entries: [LogEntry(date: Date())], policy: .never))
    }
}

struct OutlayrLogComplication: Widget {
    let kind = "OutlayrLog"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: LogProvider()) { _ in
            LogComplicationView()
        }
        .configurationDisplayName("Log expense")
        .description("Opens Outlayr ready for an amount.")
        .supportedFamilies([.accessoryCircular, .accessoryCorner])
    }
}

@main
struct OutlayrComplicationBundle: WidgetBundle {
    var body: some Widget {
        OutlayrComplication()
        OutlayrLogComplication()
        if #available(watchOS 26.0, *) {
            OutlayrLogControl()
        }
    }
}
