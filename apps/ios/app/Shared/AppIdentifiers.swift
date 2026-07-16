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

    /// CloudKit container backing `NSPersistentCloudKitContainer`.
    /// Rule: `"iCloud." + bundleIdRoot`.
    static let cloudKitContainer = "iCloud.com.tryoutlayr.app"

    /// Deep-link URL scheme, including the `://` separator. Rule: the bare
    /// Info.plist `CFBundleURLSchemes` entry is this value with `://` stripped.
    static let urlScheme = "outlayr://"

    /// Shared `UserDefaults` suite used by the app, widgets, and intents.
    /// Optional to mirror the literal `UserDefaults(suiteName:)` it replaces.
    static let sharedDefaults = UserDefaults(suiteName: appGroup)

    /// Bundle-id suffixes of the three extension targets, appended to
    /// `bundleIdRoot` to form each extension's bundle identifier.
    static let extensionSuffixes = [".ExpenditureWidget", ".BudgetIntent", ".BudgetIntentUI"]

    /// Suffix of the unit-test bundle id (`bundleIdRoot + testTargetSuffix`).
    static let testTargetSuffix = ".OutlayrTests"

    /// Ubiquity key-value store identifier declared in every target's
    /// entitlements. Rule: literal `$(TeamIdentifierPrefix)` (expanded at build
    /// time) + `bundleIdRoot`.
    static let ubiquityKVStore = "$(TeamIdentifierPrefix)com.tryoutlayr.app"
}
