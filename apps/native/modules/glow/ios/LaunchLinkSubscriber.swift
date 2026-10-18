import ExpoModulesCore

public class LaunchLinkSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    performActionFor shortcutItem: UIApplicationShortcutItem,
    completionHandler: @escaping (Bool) -> Void
  ) {
    completionHandler(open(shortcutItem.userInfo?["href"] as? String, application))
  }

  private func open(_ link: String?, _ application: UIApplication) -> Bool {
    guard let link, let url = URL(string: link) else {
      return false
    }
    _ = application.delegate?.application?(application, open: url, options: [:])
    NotificationCenter.default.post(
      name: Notification.Name("RCTOpenURLNotification"),
      object: nil,
      userInfo: ["url": url.absoluteString]
    )
    return true
  }
}
