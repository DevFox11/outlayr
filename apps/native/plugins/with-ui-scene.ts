import { withAppDelegate, withInfoPlist } from "expo/config-plugins";
import type { ConfigPlugin } from "expo/config-plugins";

const MARKER = "// @generated with-ui-scene";

// The iOS 27 SDK (Xcode 27) requires the UIScene lifecycle: apps linked
// against it that still use the legacy AppDelegate/window lifecycle are
// killed at launch (EXC_BREAKPOINT in
// _UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption). Expo's
// prebuild template has not adopted scenes yet (expo/expo#46664), so this
// plugin moves window creation + startReactNative into a SceneDelegate and
// declares the scene manifest. Delete this plugin once Expo ships official
// UIScene adoption.
//
// Adopting scenes also moves home screen quick actions off the app delegate, so
// the SceneDelegate below forwards them too — see `handleShortcut`.

const WINDOW_BLOCK_ANCHOR = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif`;

const WINDOW_BLOCK_REPLACEMENT = `${MARKER}
    self.launchOptions = launchOptions`;

const WINDOW_PROPERTY_ANCHOR = "var window: UIWindow?";

const WINDOW_PROPERTY_REPLACEMENT = `var window: UIWindow?
  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?`;

const SCENE_DELEGATE = `
${MARKER}
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate,
      let factory = appDelegate.reactNativeFactory
    else {
      return
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: appDelegate.launchOptions)
    window.makeKeyAndVisible()

    for urlContext in connectionOptions.urlContexts {
      _ = appDelegate.application(UIApplication.shared, open: urlContext.url, options: [:])
    }
    for userActivity in connectionOptions.userActivities {
      if handleSpotlight(userActivity, appDelegate) { continue }
      _ = appDelegate.application(
        UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
    }
    if let shortcutItem = connectionOptions.shortcutItem {
      handleShortcut(shortcutItem)
    }
  }

  func windowScene(
    _ windowScene: UIWindowScene,
    performActionFor shortcutItem: UIApplicationShortcutItem,
    completionHandler: @escaping (Bool) -> Void
  ) {
    handleShortcut(shortcutItem)
    completionHandler(true)
  }

  // A home screen quick action is delivered as a URL rather than handed to
  // expo-quick-actions' JS listener. Two reasons: that listener is driven by
  // \`UIApplicationDelegate.application(_:performActionFor:)\`, which the system
  // stops calling once an app adopts scenes (this one) — and routing it as a URL
  // puts quick actions through the same door as widgets and App Intents, so
  // \`+native-intent\` stays the single place the outside world's links are mapped.
  private func handleShortcut(_ shortcutItem: UIApplicationShortcutItem) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate,
      let href = shortcutItem.userInfo?["href"] as? String,
      let url = URL(string: href)
    else {
      return
    }
    _ = appDelegate.application(UIApplication.shared, open: url, options: [:])
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    for context in URLContexts {
      _ = appDelegate.application(UIApplication.shared, open: context.url, options: [:])
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    if handleSpotlight(userActivity, appDelegate) { return }
    _ = appDelegate.application(
      UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }

  // A tapped Spotlight result is opened through the app delegate's own URL path,
  // the one the widgets already come in by.
  //
  // \`expo-core-spotlight\` patches the delegate to answer this with
  // \`UIApplication.shared.open\`, which asks the system to re-launch us by URL
  // while we are mid-activation — iOS drops it and the app just surfaces on
  // whatever screen it was last on. Routing it in-process instead delivers the
  // link every time. Handled here first, so that patch never runs.
  private func handleSpotlight(
    _ userActivity: NSUserActivity,
    _ appDelegate: AppDelegate
  ) -> Bool {
    guard userActivity.activityType == CSSearchableItemActionType,
      let identifier = userActivity.userInfo?[CSSearchableItemActivityIdentifier] as? String,
      let url = URL(string: identifier)
    else {
      return false
    }
    _ = appDelegate.application(UIApplication.shared, open: url, options: [:])
    return true
  }
}
`;

const withSceneManifest: ConfigPlugin = (config) =>
    withInfoPlist(config, (plistConfig) => {
        plistConfig.modResults.UIApplicationSceneManifest = {
            UIApplicationSupportsMultipleScenes: false,
            UISceneConfigurations: {
                UIWindowSceneSessionRoleApplication: [
                    {
                        UISceneConfigurationName: "Default Configuration",
                        UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate",
                    },
                ],
            },
        };
        return plistConfig;
    });

const withSceneDelegate: ConfigPlugin = (config) =>
    withAppDelegate(config, (appDelegateConfig) => {
        const { contents, language } = appDelegateConfig.modResults;
        if (language !== "swift") {
            throw new Error(
                `withUIScene: expected a Swift AppDelegate, got "${language}". The Expo template may have changed; update this plugin.`
            );
        }
        if (contents.includes(MARKER)) {
            return appDelegateConfig;
        }
        if (!(contents.includes(WINDOW_BLOCK_ANCHOR) && contents.includes(WINDOW_PROPERTY_ANCHOR))) {
            throw new Error(
                "withUIScene: could not find the window creation block in AppDelegate.swift. The Expo template may have changed; update this plugin."
            );
        }
        // `handleSpotlight` needs the CoreSpotlight constants. `expo-core-spotlight`
        // adds this import too, so it is added only when absent — and adding it
        // here rather than relying on that plugin keeps the SceneDelegate
        // compiling if it is ever removed.
        const withImport = contents.includes("import CoreSpotlight")
            ? contents
            : contents.replace("import Expo", "import Expo\nimport CoreSpotlight");

        appDelegateConfig.modResults.contents = `${withImport
            .replace(WINDOW_BLOCK_ANCHOR, WINDOW_BLOCK_REPLACEMENT)
            .replace(WINDOW_PROPERTY_ANCHOR, WINDOW_PROPERTY_REPLACEMENT)}${SCENE_DELEGATE}`;
        return appDelegateConfig;
    });

const withUIScene: ConfigPlugin = (config) => withSceneDelegate(withSceneManifest(config));

export default withUIScene;
