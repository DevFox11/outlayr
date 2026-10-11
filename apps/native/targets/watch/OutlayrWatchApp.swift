import SwiftUI
import WatchKit

@main
struct OutlayrWatchApp: App {
    @WKApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @State private var link = PhoneLink.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(link)
        }
    }
}

final class AppDelegate: NSObject, WKApplicationDelegate {
    func handle(_ backgroundTasks: Set<WKRefreshBackgroundTask>) {
        for task in backgroundTasks {
            if let task = task as? WKWatchConnectivityRefreshBackgroundTask {
                PhoneLink.shared.hold(task)
            } else {
                task.setTaskCompletedWithSnapshot(false)
            }
        }
    }
}
