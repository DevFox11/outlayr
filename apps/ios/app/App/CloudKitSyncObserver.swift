import CloudKitSyncMonitor
import Observation

@MainActor @Observable
final class CloudKitSyncObserver {
    private(set) var syncStateSummary: SyncMonitor.SyncSummaryStatus = SyncMonitor.shared.syncStateSummary

    private var observationTask: Task<Void, Never>?

    init() {
        observationTask = Task {
            for await _ in NotificationCenter.default.notifications(
                named: NSPersistentCloudKitContainer.eventChangedNotification
            ) {
                syncStateSummary = SyncMonitor.shared.syncStateSummary
            }
        }
    }

    deinit {
        observationTask?.cancel()
    }
}
