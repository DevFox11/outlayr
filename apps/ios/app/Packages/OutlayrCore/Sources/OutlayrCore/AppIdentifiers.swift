//
//  AppIdentifiers.swift
//  Shared across the app and every extension target
//
//  Single source of truth for the app's identity strings: bundle-id root, app
//  group, CloudKit container, and deep-link URL scheme. Compiled into the app,
//  the widget, and both intent extensions so every process derives its
//  identifiers from one place instead of scattered string literals.
//
//  The rebrand flips these values in one atomic commit. The identity CI gate
//  parses these declarations and asserts the non-Swift surfaces (entitlements,
//  Info.plist, pbxproj) match, so the derivation rules noted below must hold.
//

import Foundation

enum AppIdentifiers {
    /// Bundle-identifier root shared by the app and every extension target.
    static let bundleIdRoot = "com.tryoutlayr.app"

    /// App-group suite backing the shared `UserDefaults` and the Core Data
    /// store. Rule: `"group." + bundleIdRoot`.
    static let appGroup = "group.com.tryoutlayr.app"

    /// Deep-link URL scheme, including the `://` separator. Rule: the bare
    /// Info.plist `CFBundleURLSchemes` entry is this value with `://` stripped.
    static let urlScheme = "outlayr://"

    /// Shared `UserDefaults` suite used by the app, widgets, and intents.
    /// Optional to mirror the literal `UserDefaults(suiteName:)` it replaces.
    static let sharedDefaults = UserDefaults(suiteName: appGroup)

    /// Non-optional access to the shared defaults suite.
    /// Falls back to `.standard` only when `UserDefaults(suiteName:)` returns
    /// nil — which doesn't happen in production but can occur in misconfigured
    /// test hosts. Prefer this over force-unwrapping `sharedDefaults`.
    static var defaults: UserDefaults { sharedDefaults ?? .standard }

    /// Bundle-id suffixes of the three extension targets, appended to
    /// `bundleIdRoot` to form each extension's bundle identifier.
    static let extensionSuffixes = [".ExpenditureWidget", ".BudgetIntent", ".BudgetIntentUI"]

    /// Suffix of the unit-test bundle id (`bundleIdRoot + testTargetSuffix`).
    static let testTargetSuffix = ".OutlayrTests"

}

/// Typed keys for the shared `UserDefaults` suite.
/// Use these constants instead of raw string literals to prevent
/// typo-induced desync between the app, widgets, and intent extensions.
/// Accessible in every target that compiles AppIdentifiers.swift.
enum DefaultsKey {
    // Display & formatting
    static let currency = "currency"
    static let showCents = "showCents"
    static let colorScheme = "colorScheme"
    static let animated = "animated"
    static let activeIcon = "activeIcon"
    static let chromatic = "chromatic"

    // Calendar & timing
    static let firstWeekday = "firstWeekday"
    static let firstDayOfMonth = "firstDayOfMonth"

    // UI behavior
    static let numberEntryType = "numberEntryType"
    static let haptics = "haptics"
    static let confetti = "confetti"
    static let topEdge = "topEdge"
    static let bottomEdge = "bottomEdge"
    static let swapTimeLabel = "swapTimeLabel"
    static let budgetViewStyle = "budgetViewStyle"
    static let showExpenseOrIncomeSign = "showExpenseOrIncomeSign"
    static let incomeTracking = "incomeTracking"
    static let keyboard = "keyboard"

    // Logs & insights
    static let logTimeFrame = "logTimeFrame"
    static let chartTimeFrame = "chartTimeFrame"
    static let logInsightsTimeFrame = "logInsightsTimeFrame"
    static let logInsightsType = "logInsightsType"
    static let logViewLineGraph = "logViewLineGraph"
    static let insightsViewIncomeFiltering = "insightsViewIncomeFiltering"

    // Upcoming transactions
    static let showUpcomingTransactions = "showUpcomingTransactions"
    static let showUpcomingTransactionsWhenUpcoming = "showUpcomingTransactionsWhenUpcoming"

    // Notifications
    static let showNotifications = "showNotifications"
    static let notificationsEnabled = "notificationsEnabled"
    static let notificationOption = "notificationOption"
    static let customHour = "customHour"
    static let customMinute = "customMinute"

    // Onboarding & migrations
    static let firstLaunch = "firstLaunch"
    static let firstTransactionViewLaunch = "firstTransactionViewLaunch"
    static let dataMigration1 = "dataMigration1"
    static let dataMigration2 = "dataMigration2"
    static let categoryPaletteMigrationV2 = "categoryPaletteMigrationV2"

    // Categories
    static let categorySuggestions = "categorySuggestions"

    // Internal widget/app bridge flag
    static let newTransactionAdded = "newTransactionAdded"

    // App lock — stored in `UserDefaults.standard`, not the shared suite
    static let appLockEnabled = "appLockEnabled"
}
