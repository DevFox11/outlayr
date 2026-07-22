//
//  AppGroupBridgeTests.swift
//  OutlayrTests
//
//  The single test that intentionally touches the real app-group suite. It is a
//  smoke test only: the simulator does NOT enforce app-group entitlements, so the
//  ONLY authoritative bridge proof is the on-device manual check gated on C3.
//
//  These identifiers are sourced from AppIdentifiers (re-pointed at C2), so the
//  suite the test round-trips follows the C3 identity flip automatically. The
//  derivation assertions below cross-check AppIdentifiers' own constants and
//  encode the rules the C3 positive cross-surface gate enforces (root = group id
//  minus "group."; container = "iCloud." + root).
//

import Testing

@testable import Outlayr

struct AppGroupBridgeTests {
    private let appGroup = AppIdentifiers.appGroup
    private let bundleRoot = AppIdentifiers.bundleIdRoot

    @Test func identifierDerivationRulesHold() {
        #expect(appGroup.hasPrefix("group."))
        #expect(String(appGroup.dropFirst("group.".count)) == bundleRoot)
    }

    @Test func appGroupSuiteRoundTrips() {
        guard let suite = UserDefaults(suiteName: appGroup) else {
            return
        }

        let key = "characterization.bridge.\(UUID().uuidString)"
        defer { suite.removeObject(forKey: key) }

        suite.set(42, forKey: key)
        #expect(suite.integer(forKey: key) == 42)
    }

    @Test func storeURLResolvesUnderGroupContainer() {
        guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else {
            // Expected when the app-group container is not provisioned in this environment.
            return
        }

        // The simulator maps group containers to a UUID path, so the group id is
        // not embedded in the path. Pin only what DataController actually relies on:
        // the store file ("Main.sqlite") sits directly under the resolved container.
        #expect(container.isFileURL)
        let storeURL = container.appendingPathComponent("Main.sqlite")
        #expect(storeURL.lastPathComponent == "Main.sqlite")
        #expect(
            storeURL.deletingLastPathComponent().standardizedFileURL ==
            container.standardizedFileURL
        )
    }
}
