import Foundation
import Observation
import WatchConnectivity
import WatchKit
import WidgetKit

@Observable
final class PhoneLink: NSObject, WCSessionDelegate {
    static let shared = PhoneLink()

    static let appGroup = "group.com.tryoutlayr.app"
    static let snapshotKey = "watchSnapshot"

    private(set) var snapshot: WatchSnapshot?
    @ObservationIgnored private var backgroundTasks: [WKWatchConnectivityRefreshBackgroundTask] = []

    private override init() {
        super.init()
        snapshot = Self.restore()
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func log(_ write: WatchWrite) {
        send(write.message)
    }

    func note(_ id: String, _ text: String) {
        send(["type": "note", "id": id, "note": text])
    }

    func hold(_ task: WKWatchConnectivityRefreshBackgroundTask) {
        backgroundTasks.append(task)
        releaseIfIdle()
    }

    private func send(_ message: [String: Any]) {
        let session = WCSession.default
        if session.isReachable {
            session.sendMessage(message, replyHandler: nil) { _ in
                session.transferUserInfo(message)
            }
        } else {
            session.transferUserInfo(message)
        }
    }

    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        receive(session.receivedApplicationContext)
    }

    func session(_ session: WCSession, didReceiveApplicationContext context: [String: Any]) {
        receive(context)
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        receive(userInfo)
    }

    private func receive(_ payload: [String: Any]) {
        Task { @MainActor in
            if let snapshot = Self.load(from: payload) {
                self.apply(snapshot)
            }
            self.releaseIfIdle()
        }
    }

    @MainActor
    private func apply(_ snapshot: WatchSnapshot) {
        self.snapshot = snapshot
        if let data = try? JSONEncoder().encode(snapshot) {
            UserDefaults(suiteName: Self.appGroup)?.set(data, forKey: Self.snapshotKey)
            WidgetCenter.shared.reloadAllTimelines()
        }
    }

    private func releaseIfIdle() {
        guard !WCSession.default.hasContentPending else { return }
        backgroundTasks.forEach { $0.setTaskCompletedWithSnapshot(false) }
        backgroundTasks = []
    }

    private static func load(from payload: [String: Any]) -> WatchSnapshot? {
        guard let raw = payload["snapshot"] as? String, let data = raw.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(WatchSnapshot.self, from: data)
    }

    private static func restore() -> WatchSnapshot? {
        guard let data = UserDefaults(suiteName: appGroup)?.data(forKey: snapshotKey) else { return nil }
        return try? JSONDecoder().decode(WatchSnapshot.self, from: data)
    }
}
