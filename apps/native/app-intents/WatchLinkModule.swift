internal import ExpoModulesCore

final class WatchLinkModule: Module {
  private var observer: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("WatchLink")

    Events("pendingWrite")

    OnCreate {
      WatchLink.shared.activate()
    }

    OnStartObserving {
      observer = NotificationCenter.default.addObserver(
        forName: WatchLink.pendingWriteNotification, object: nil, queue: .main
      ) { [weak self] _ in
        self?.sendEvent("pendingWrite")
      }
    }

    OnStopObserving {
      if let observer { NotificationCenter.default.removeObserver(observer) }
      observer = nil
    }

    Function("publish") { (snapshot: String) in
      try WatchLink.shared.publish(snapshot)
    }
  }
}
