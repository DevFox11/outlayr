//
//  TransactionIdentityTests.swift
//  OutlayrTests
//
//  Covers the MainModel 4 transaction identity attributes (emoji, icon,
//  imageData, imageColour, customColour, currency) and the storage-level
//  accessors that resolve them against the owning category.
//

import CoreData
import XCTest

@testable import Outlayr

final class TransactionIdentityTests: CharacterizationTestCase {
    private func makeContext() -> NSManagedObjectContext {
        makeController(now: referenceDate, defaults: makeIsolatedDefaults()).container.viewContext
    }

    func testFreshTransactionHasNilIdentityAttributes() {
        let context = makeContext()
        let transaction = makeTransaction(in: context, amount: 12, date: referenceDate)

        XCTAssertNil(transaction.emoji)
        XCTAssertNil(transaction.icon)
        XCTAssertNil(transaction.imageData)
        XCTAssertNil(transaction.imageColour)
        XCTAssertNil(transaction.customColour)
        XCTAssertNil(transaction.currency)
    }

    func testIdentityAttributesRoundTripThroughTheStore() throws {
        let context = makeContext()
        let transaction = makeTransaction(in: context, amount: 42, date: referenceDate)
        let payload = Data([0xDE, 0xAD, 0xBE, 0xEF])
        transaction.emoji = "🍎"
        transaction.icon = "sale-tag-01"
        transaction.imageData = payload
        transaction.imageColour = "#123456"
        transaction.customColour = "#ABCDEF"
        transaction.currency = "JPY"
        try context.save()

        context.refreshAllObjects()
        let request = Transaction.fetchRequest()
        let stored = try XCTUnwrap(context.fetch(request).first)

        XCTAssertEqual(stored.emoji, "🍎")
        XCTAssertEqual(stored.icon, "sale-tag-01")
        XCTAssertEqual(stored.imageData, payload)
        XCTAssertEqual(stored.imageColour, "#123456")
        XCTAssertEqual(stored.customColour, "#ABCDEF")
        XCTAssertEqual(stored.currency, "JPY")
    }

    func testWrappedCurrencyIsNilWhenUnsetOrBlank() {
        let context = makeContext()
        let transaction = makeTransaction(in: context, amount: 1, date: referenceDate)

        XCTAssertNil(transaction.wrappedCurrency)

        transaction.currency = ""
        XCTAssertNil(transaction.wrappedCurrency)

        transaction.currency = "EUR"
        XCTAssertEqual(transaction.wrappedCurrency, "EUR")
    }

    func testWrappedCurrencyNormalisesCaseAndSurroundingWhitespace() {
        let context = makeContext()
        let transaction = makeTransaction(in: context, amount: 1, date: referenceDate)

        transaction.currency = "  usd  "
        XCTAssertEqual(transaction.wrappedCurrency, "USD")

        transaction.currency = "eur"
        XCTAssertEqual(transaction.wrappedCurrency, "EUR")
    }

    func testWrappedCurrencyRejectsAnythingThatIsNotThreeAsciiLetters() {
        let context = makeContext()
        let transaction = makeTransaction(in: context, amount: 1, date: referenceDate)

        for invalid in ["XX", "BITCOIN", " ", "12", "US1", "€€€"] {
            transaction.currency = invalid
            XCTAssertNil(transaction.wrappedCurrency, "expected \(invalid) to be rejected")
        }
    }

    func testEffectiveColourPrefersCustomThenImageThenCategory() {
        let context = makeContext()
        let category = makeCategory(in: context, name: "Groceries")
        category.colour = "#111111"
        let transaction = makeTransaction(in: context, amount: 1, date: referenceDate, category: category)

        XCTAssertEqual(transaction.effectiveColour, "#111111")

        transaction.imageColour = "#222222"
        XCTAssertEqual(transaction.effectiveColour, "#222222")

        transaction.customColour = "#333333"
        XCTAssertEqual(transaction.effectiveColour, "#333333")
    }

    func testEffectiveColourIgnoresBlankOverrides() {
        let context = makeContext()
        let category = makeCategory(in: context, name: "Groceries")
        category.colour = "#111111"
        let transaction = makeTransaction(in: context, amount: 1, date: referenceDate, category: category)
        transaction.customColour = ""
        transaction.imageColour = ""

        XCTAssertEqual(transaction.effectiveColour, "#111111")
    }

    func testOwnSymbolIsNilWithoutStoredIdentity() {
        let context = makeContext()
        let category = makeCategory(in: context, name: "Groceries", icon: "sale-tag-01")
        let transaction = makeTransaction(in: context, amount: 1, date: referenceDate, category: category)

        XCTAssertNil(transaction.ownSymbol)
        XCTAssertEqual(transaction.displaySymbol, category.displaySymbol)
    }

    func testOwnSymbolResolvesStoredIconThroughTheCatalog() throws {
        let context = makeContext()
        let transaction = makeTransaction(in: context, amount: 1, date: referenceDate)
        transaction.icon = "sale-tag-01"

        let expected = try XCTUnwrap(CategoryIconCatalog.icon(named: "sale-tag-01"))
        XCTAssertEqual(transaction.ownSymbol, .icon(expected))
        XCTAssertEqual(transaction.displaySymbol, .icon(expected))
    }

    func testOwnSymbolFallsBackToEmojiWhenNoIconIsStored() {
        let context = makeContext()
        let transaction = makeTransaction(in: context, amount: 1, date: referenceDate)
        transaction.emoji = "⛵️"

        XCTAssertEqual(transaction.ownSymbol, .emoji("⛵️"))
        XCTAssertEqual(transaction.displaySymbol, .emoji("⛵️"))
    }

    func testStoredIconWinsOverStoredEmoji() throws {
        let context = makeContext()
        let transaction = makeTransaction(in: context, amount: 1, date: referenceDate)
        transaction.icon = "sale-tag-01"
        transaction.emoji = "⛵️"

        let expected = try XCTUnwrap(CategoryIconCatalog.icon(named: "sale-tag-01"))
        XCTAssertEqual(transaction.ownSymbol, .icon(expected))
    }

    /// `wrappedIcon` is the icon projection of `displaySymbol`, so the two can
    /// never disagree: an emoji-only transaction shows its emoji and, where an
    /// icon is structurally required, the income-appropriate fallback — never
    /// the category's icon, which would contradict what the user sees.
    func testEmojiOnlyTransactionFallsBackToTheCatalogFallbackNotTheCategoryIcon() throws {
        let context = makeContext()
        // A category icon distinct from fallbackExpense, so "not the category
        // icon" is a real assertion rather than a coincidence.
        let category = makeCategory(in: context, name: "Groceries", icon: "coins-01")
        let transaction = makeTransaction(in: context, amount: 1, date: referenceDate, category: category)
        transaction.emoji = "⛵️"

        XCTAssertEqual(transaction.displaySymbol, .emoji("⛵️"))
        XCTAssertEqual(transaction.wrappedIcon, CategoryIconCatalog.fallbackExpense)
        XCTAssertNotEqual(transaction.wrappedIcon, try XCTUnwrap(CategoryIconCatalog.icon(named: "coins-01")))
    }

    func testEmojiOnlyTransactionUsesTheIncomeFallbackUnderAnIncomeCategory() {
        let context = makeContext()
        let category = makeCategory(in: context, name: "Salary", icon: "coins-01", income: true)
        let transaction = makeTransaction(
            in: context, amount: 1, date: referenceDate, income: true, category: category
        )
        transaction.emoji = "⛵️"

        XCTAssertEqual(transaction.wrappedIcon, CategoryIconCatalog.fallbackIncome)
    }

    func testBlankIconNameIsTreatedAsNoIdentity() {
        let context = makeContext()
        let category = makeCategory(in: context, name: "Groceries", icon: "sale-tag-01")
        let transaction = makeTransaction(in: context, amount: 1, date: referenceDate, category: category)
        transaction.icon = ""

        XCTAssertNil(transaction.ownSymbol)
        XCTAssertEqual(transaction.displaySymbol, category.displaySymbol)
    }

    /// An unresolvable icon name must not manufacture a fallback glyph — the
    /// transaction has no identity of its own, so the category's symbol shows.
    func testUnknownIconNameFallsThroughToEmojiThenCategory() {
        let context = makeContext()
        let category = makeCategory(in: context, name: "Groceries", icon: "sale-tag-01")
        let transaction = makeTransaction(in: context, amount: 1, date: referenceDate, category: category)
        transaction.icon = "not-a-real-icon"

        XCTAssertNil(transaction.ownSymbol)
        XCTAssertEqual(transaction.displaySymbol, category.displaySymbol)

        transaction.emoji = "⛵️"
        XCTAssertEqual(transaction.ownSymbol, .emoji("⛵️"))
    }

    func testWrappedIconPrefersTheTransactionIconOverTheCategoryIcon() throws {
        let context = makeContext()
        let category = makeCategory(in: context, name: "Groceries", icon: "sale-tag-01")
        let transaction = makeTransaction(in: context, amount: 1, date: referenceDate, category: category)
        transaction.icon = "coins-01"

        XCTAssertEqual(transaction.wrappedIcon, try XCTUnwrap(CategoryIconCatalog.icon(named: "coins-01")))

        transaction.icon = nil
        XCTAssertEqual(transaction.wrappedIcon, category.wrappedIcon)
    }

    /// The in-memory store used everywhere else never spills a blob to disk, so
    /// `allowsExternalBinaryDataStorage` only gets exercised against a real
    /// SQLite file. Round-trip only — the sidecar layout is Core Data's business.
    func testLargeImageDataRoundTripsThroughAnOnDiskStore() throws {
        let momd = try XCTUnwrap(
            Bundle(for: DataController.self).url(forResource: "MainModel", withExtension: "momd")
        )
        let model = try XCTUnwrap(NSManagedObjectModel(contentsOf: momd))
        let storeDirectory = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("blob-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: storeDirectory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: storeDirectory) }
        let storeURL = storeDirectory.appendingPathComponent("MainModel.sqlite")

        let payload = Data((0 ..< 2_000_000).map { UInt8($0 % 251) })

        let writeCoordinator = NSPersistentStoreCoordinator(managedObjectModel: model)
        try writeCoordinator.addPersistentStore(
            ofType: NSSQLiteStoreType, configurationName: nil, at: storeURL, options: nil
        )
        let writeContext = NSManagedObjectContext(concurrencyType: .mainQueueConcurrencyType)
        writeContext.persistentStoreCoordinator = writeCoordinator
        let written = NSEntityDescription.insertNewObject(forEntityName: "Transaction", into: writeContext)
        written.setValue(1.0, forKey: "amount")
        written.setValue(referenceDate, forKey: "date")
        written.setValue(payload, forKey: "imageData")
        try writeContext.save()
        for store in writeCoordinator.persistentStores {
            try writeCoordinator.remove(store)
        }

        let readCoordinator = NSPersistentStoreCoordinator(managedObjectModel: model)
        try readCoordinator.addPersistentStore(
            ofType: NSSQLiteStoreType, configurationName: nil, at: storeURL, options: nil
        )
        let readContext = NSManagedObjectContext(concurrencyType: .mainQueueConcurrencyType)
        readContext.persistentStoreCoordinator = readCoordinator
        let reloaded = try XCTUnwrap(
            readContext.fetch(NSFetchRequest<NSManagedObject>(entityName: "Transaction")).first
        )

        XCTAssertEqual(reloaded.value(forKey: "imageData") as? Data, payload)
    }

    /// Seeds a transaction into a store built from `momName`, then reopens that
    /// store under the current model with nothing but Core Data's inferred
    /// lightweight migration. Only `amount`/`date` are seeded — every shipped
    /// version has both, so one helper covers the whole chain.
    private func assertLightweightMigrationToCurrentModel(
        fromMomNamed momName: String,
        file: StaticString = #filePath,
        line: UInt = #line
    ) throws {
        let momd = try XCTUnwrap(
            Bundle(for: DataController.self).url(forResource: "MainModel", withExtension: "momd"),
            "MainModel.momd is missing from the test bundle", file: file, line: line
        )
        let legacyURL = momd.appendingPathComponent("\(momName).mom")
        XCTAssertTrue(
            FileManager.default.fileExists(atPath: legacyURL.path),
            "\(momName).mom does not ship — its version is unregistered in the XCVersionGroup",
            file: file, line: line
        )
        let legacyModel = try XCTUnwrap(
            NSManagedObjectModel(contentsOf: legacyURL), file: file, line: line
        )
        let currentModel = try XCTUnwrap(NSManagedObjectModel(contentsOf: momd), file: file, line: line)

        let storeURL = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("migration-\(UUID().uuidString).sqlite")
        defer { try? FileManager.default.removeItem(at: storeURL) }

        let legacyCoordinator = NSPersistentStoreCoordinator(managedObjectModel: legacyModel)
        try legacyCoordinator.addPersistentStore(
            ofType: NSSQLiteStoreType, configurationName: nil, at: storeURL, options: nil
        )
        let legacyContext = NSManagedObjectContext(concurrencyType: .mainQueueConcurrencyType)
        legacyContext.persistentStoreCoordinator = legacyCoordinator
        let legacy = NSEntityDescription.insertNewObject(forEntityName: "Transaction", into: legacyContext)
        legacy.setValue(99.0, forKey: "amount")
        legacy.setValue(referenceDate, forKey: "date")
        try legacyContext.save()
        for store in legacyCoordinator.persistentStores {
            try legacyCoordinator.remove(store)
        }

        let migratedCoordinator = NSPersistentStoreCoordinator(managedObjectModel: currentModel)
        try migratedCoordinator.addPersistentStore(
            ofType: NSSQLiteStoreType,
            configurationName: nil,
            at: storeURL,
            options: [
                NSMigratePersistentStoresAutomaticallyOption: true,
                NSInferMappingModelAutomaticallyOption: true
            ]
        )
        let migratedContext = NSManagedObjectContext(concurrencyType: .mainQueueConcurrencyType)
        migratedContext.persistentStoreCoordinator = migratedCoordinator
        let migrated = try XCTUnwrap(
            migratedContext.fetch(NSFetchRequest<NSManagedObject>(entityName: "Transaction")).first,
            "the seeded transaction did not survive migration from \(momName)", file: file, line: line
        )

        XCTAssertEqual(migrated.value(forKey: "amount") as? Double, 99.0, file: file, line: line)
        XCTAssertNil(migrated.value(forKey: "emoji"), file: file, line: line)
        XCTAssertNil(migrated.value(forKey: "icon"), file: file, line: line)
        XCTAssertNil(migrated.value(forKey: "imageData"), file: file, line: line)
        XCTAssertNil(migrated.value(forKey: "imageColour"), file: file, line: line)
        XCTAssertNil(migrated.value(forKey: "customColour"), file: file, line: line)
        XCTAssertNil(migrated.value(forKey: "currency"), file: file, line: line)
        XCTAssertNil(migrated.value(forKey: "recurringEndDate"), file: file, line: line)
    }

    // These cover the chain as it ships TODAY. The V2 XML was edited in place
    // historically, so a store written by the pre-edit build wouldn't match it —
    // but those stores are pre-fork-era and unreachable under the Outlayr bundle,
    // app group, and CloudKit container (docs/decisions/rebrand-identity.md:
    // no user-data migration, a fresh container is provisioned).

    func testStoreCreatedWithVersion1OpensUnderCurrentModel() throws {
        try assertLightweightMigrationToCurrentModel(fromMomNamed: "MainModel")
    }

    func testStoreCreatedWithVersion2OpensUnderCurrentModel() throws {
        try assertLightweightMigrationToCurrentModel(fromMomNamed: "MainModel 2")
    }

    func testStoreCreatedWithVersion3OpensUnderCurrentModel() throws {
        try assertLightweightMigrationToCurrentModel(fromMomNamed: "MainModel 3")
    }

    func testStoreCreatedWithVersion4OpensUnderCurrentModel() throws {
        try assertLightweightMigrationToCurrentModel(fromMomNamed: "MainModel 4")
    }
}
