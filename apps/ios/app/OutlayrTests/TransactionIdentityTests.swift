//
//  TransactionIdentityTests.swift
//  OutlayrTests
//
//  Covers the MainModel 4 transaction identity attributes (emoji, icon,
//  imageData, imageColor, customColor, currency) and the storage-level
//  accessors that resolve them against the owning category.
//

import CoreData
import Testing

@testable import Outlayr

@MainActor
struct TransactionIdentityTests {
    private func makeContext() -> NSManagedObjectContext {
        var f = CharacterizationFixture()
        return f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults()).container.viewContext
    }

    @Test func freshTransactionHasNilIdentityAttributes() {
        let f = CharacterizationFixture()
        let context = makeContext()
        let transaction = f.makeTransaction(in: context, amount: 12, date: f.referenceDate)

        #expect(transaction.emoji == nil)
        #expect(transaction.icon == nil)
        #expect(transaction.imageData == nil)
        #expect(transaction.imageColor == nil)
        #expect(transaction.customColor == nil)
        #expect(transaction.currency == nil)
    }

    @Test func identityAttributesRoundTripThroughTheStore() throws {
        let f = CharacterizationFixture()
        let context = makeContext()
        let transaction = f.makeTransaction(in: context, amount: 42, date: f.referenceDate)
        let payload = Data([0xDE, 0xAD, 0xBE, 0xEF])
        transaction.emoji = "🍎"
        transaction.icon = "sale-tag-01"
        transaction.imageData = payload
        transaction.imageColor = "#123456"
        transaction.customColor = "#ABCDEF"
        transaction.currency = "JPY"
        try context.save()

        context.refreshAllObjects()
        let request = Transaction.fetchRequest()
        let stored = try #require(context.fetch(request).first)

        #expect(stored.emoji == "🍎")
        #expect(stored.icon == "sale-tag-01")
        #expect(stored.imageData == payload)
        #expect(stored.imageColor == "#123456")
        #expect(stored.customColor == "#ABCDEF")
        #expect(stored.currency == "JPY")
    }

    @Test func wrappedCurrencyIsNilWhenUnsetOrBlank() {
        let f = CharacterizationFixture()
        let context = makeContext()
        let transaction = f.makeTransaction(in: context, amount: 1, date: f.referenceDate)

        #expect(transaction.wrappedCurrency == nil)

        transaction.currency = ""
        #expect(transaction.wrappedCurrency == nil)

        transaction.currency = "EUR"
        #expect(transaction.wrappedCurrency == "EUR")
    }

    @Test func wrappedCurrencyNormalisesCaseAndSurroundingWhitespace() {
        let f = CharacterizationFixture()
        let context = makeContext()
        let transaction = f.makeTransaction(in: context, amount: 1, date: f.referenceDate)

        transaction.currency = "  usd  "
        #expect(transaction.wrappedCurrency == "USD")

        transaction.currency = "eur"
        #expect(transaction.wrappedCurrency == "EUR")
    }

    @Test func wrappedCurrencyRejectsAnythingThatIsNotThreeAsciiLetters() {
        let f = CharacterizationFixture()
        let context = makeContext()
        let transaction = f.makeTransaction(in: context, amount: 1, date: f.referenceDate)

        for invalid in ["XX", "BITCOIN", " ", "12", "US1", "€€€"] {
            transaction.currency = invalid
            #expect(transaction.wrappedCurrency == nil, "expected \(invalid) to be rejected")
        }
    }

    @Test func effectiveColorPrefersCustomThenImageThenCategory() {
        let f = CharacterizationFixture()
        let context = makeContext()
        let category = f.makeCategory(in: context, name: "Groceries")
        category.color = "#111111"
        let transaction = f.makeTransaction(in: context, amount: 1, date: f.referenceDate, category: category)

        #expect(transaction.effectiveColor == "#111111")

        transaction.imageColor = "#222222"
        #expect(transaction.effectiveColor == "#222222")

        transaction.customColor = "#333333"
        #expect(transaction.effectiveColor == "#333333")
    }

    @Test func effectiveColorIgnoresBlankOverrides() {
        let f = CharacterizationFixture()
        let context = makeContext()
        let category = f.makeCategory(in: context, name: "Groceries")
        category.color = "#111111"
        let transaction = f.makeTransaction(in: context, amount: 1, date: f.referenceDate, category: category)
        transaction.customColor = ""
        transaction.imageColor = ""

        #expect(transaction.effectiveColor == "#111111")
    }

    @Test func ownSymbolIsNilWithoutStoredIdentity() {
        let f = CharacterizationFixture()
        let context = makeContext()
        let category = f.makeCategory(in: context, name: "Groceries", icon: "sale-tag-01")
        let transaction = f.makeTransaction(in: context, amount: 1, date: f.referenceDate, category: category)

        #expect(transaction.ownSymbol == nil)
        #expect(transaction.displaySymbol == category.displaySymbol)
    }

    @Test func ownSymbolResolvesStoredIconThroughTheCatalog() throws {
        let f = CharacterizationFixture()
        let context = makeContext()
        let transaction = f.makeTransaction(in: context, amount: 1, date: f.referenceDate)
        transaction.icon = "sale-tag-01"

        let expected = try #require(CategoryIconCatalog.icon(named: "sale-tag-01"))
        #expect(transaction.ownSymbol == .icon(expected))
        #expect(transaction.displaySymbol == .icon(expected))
    }

    @Test func ownSymbolFallsBackToEmojiWhenNoIconIsStored() {
        let f = CharacterizationFixture()
        let context = makeContext()
        let transaction = f.makeTransaction(in: context, amount: 1, date: f.referenceDate)
        transaction.emoji = "⛵️"

        #expect(transaction.ownSymbol == .emoji("⛵️"))
        #expect(transaction.displaySymbol == .emoji("⛵️"))
    }

    @Test func storedIconWinsOverStoredEmoji() throws {
        let f = CharacterizationFixture()
        let context = makeContext()
        let transaction = f.makeTransaction(in: context, amount: 1, date: f.referenceDate)
        transaction.icon = "sale-tag-01"
        transaction.emoji = "⛵️"

        let expected = try #require(CategoryIconCatalog.icon(named: "sale-tag-01"))
        #expect(transaction.ownSymbol == .icon(expected))
    }

    /// `wrappedIcon` is the icon projection of `displaySymbol`, so the two can
    /// never disagree: an emoji-only transaction shows its emoji and, where an
    /// icon is structurally required, the income-appropriate fallback — never
    /// the category's icon, which would contradict what the user sees.
    @Test func emojiOnlyTransactionFallsBackToTheCatalogFallbackNotTheCategoryIcon() throws {
        let f = CharacterizationFixture()
        let context = makeContext()
        // A category icon distinct from fallbackExpense, so "not the category
        // icon" is a real assertion rather than a coincidence.
        let category = f.makeCategory(in: context, name: "Groceries", icon: "coins-01")
        let transaction = f.makeTransaction(in: context, amount: 1, date: f.referenceDate, category: category)
        transaction.emoji = "⛵️"

        #expect(transaction.displaySymbol == .emoji("⛵️"))
        #expect(transaction.wrappedIcon == CategoryIconCatalog.fallbackExpense)
        #expect(transaction.wrappedIcon != (try #require(CategoryIconCatalog.icon(named: "coins-01"))))
    }

    @Test func emojiOnlyTransactionUsesTheIncomeFallbackUnderAnIncomeCategory() {
        let f = CharacterizationFixture()
        let context = makeContext()
        let category = f.makeCategory(in: context, name: "Salary", icon: "coins-01", income: true)
        let transaction = f.makeTransaction(
            in: context, amount: 1, date: f.referenceDate, income: true, category: category
        )
        transaction.emoji = "⛵️"

        #expect(transaction.wrappedIcon == CategoryIconCatalog.fallbackIncome)
    }

    @Test func blankIconNameIsTreatedAsNoIdentity() {
        let f = CharacterizationFixture()
        let context = makeContext()
        let category = f.makeCategory(in: context, name: "Groceries", icon: "sale-tag-01")
        let transaction = f.makeTransaction(in: context, amount: 1, date: f.referenceDate, category: category)
        transaction.icon = ""

        #expect(transaction.ownSymbol == nil)
        #expect(transaction.displaySymbol == category.displaySymbol)
    }

    /// An unresolvable icon name must not manufacture a fallback glyph — the
    /// transaction has no identity of its own, so the category's symbol shows.
    @Test func unknownIconNameFallsThroughToEmojiThenCategory() {
        let f = CharacterizationFixture()
        let context = makeContext()
        let category = f.makeCategory(in: context, name: "Groceries", icon: "sale-tag-01")
        let transaction = f.makeTransaction(in: context, amount: 1, date: f.referenceDate, category: category)
        transaction.icon = "not-a-real-icon"

        #expect(transaction.ownSymbol == nil)
        #expect(transaction.displaySymbol == category.displaySymbol)

        transaction.emoji = "⛵️"
        #expect(transaction.ownSymbol == .emoji("⛵️"))
    }

    @Test func wrappedIconPrefersTheTransactionIconOverTheCategoryIcon() throws {
        let f = CharacterizationFixture()
        let context = makeContext()
        let category = f.makeCategory(in: context, name: "Groceries", icon: "sale-tag-01")
        let transaction = f.makeTransaction(in: context, amount: 1, date: f.referenceDate, category: category)
        transaction.icon = "coins-01"

        #expect(transaction.wrappedIcon == (try #require(CategoryIconCatalog.icon(named: "coins-01"))))

        transaction.icon = nil
        #expect(transaction.wrappedIcon == category.wrappedIcon)
    }

    /// Loads an `NSManagedObjectModel` from `url` and strips all entity subclass
    /// registrations by forcing `managedObjectClassName` to `"NSManagedObject"`.
    /// Migration tests use KVC-only access, so they never need typed subclasses.
    /// Without this, each coordinator initialised from a locally-loaded model
    /// registers `Category` / `Transaction` ObjC class names against a fresh set
    /// of `NSEntityDescription` instances, making `+[Category entity]` ambiguous
    /// for the rest of the process — crashing fixture-based tests that run after.
    private func isolatedModel(from url: URL) throws -> NSManagedObjectModel {
        let model = try #require(NSManagedObjectModel(contentsOf: url))
        for entity in model.entities {
            entity.managedObjectClassName = "NSManagedObject"
        }
        return model
    }

    /// The in-memory store used everywhere else never spills a blob to disk, so
    /// `allowsExternalBinaryDataStorage` only gets exercised against a real
    /// SQLite file. Round-trip only — the sidecar layout is Core Data's business.
    @Test func largeImageDataRoundTripsThroughAnOnDiskStore() throws {
        let f = CharacterizationFixture()
        let momd = try #require(
            Bundle(for: DataController.self).url(forResource: "MainModel", withExtension: "momd")
        )
        let model = try isolatedModel(from: momd)
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
        written.setValue(f.referenceDate, forKey: "date")
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
        let reloaded = try #require(
            readContext.fetch(NSFetchRequest<NSManagedObject>(entityName: "Transaction")).first
        )

        #expect(reloaded.value(forKey: "imageData") as? Data == payload)
    }

    /// Seeds a transaction into a store built from `momName`, then reopens that
    /// store under the current model with nothing but Core Data's inferred
    /// lightweight migration. Only `amount`/`date` are seeded — every shipped
    /// version has both, so one helper covers the whole chain.
    private func assertLightweightMigrationToCurrentModel(fromMomNamed momName: String) throws {
        let f = CharacterizationFixture()
        let momd = try #require(
            Bundle(for: DataController.self).url(forResource: "MainModel", withExtension: "momd"),
            "MainModel.momd is missing from the test bundle"
        )
        let legacyURL = momd.appendingPathComponent("\(momName).mom")
        #expect(
            FileManager.default.fileExists(atPath: legacyURL.path),
            "\(momName).mom does not ship — its version is unregistered in the XCVersionGroup"
        )
        let legacyModel = try isolatedModel(from: legacyURL)
        let currentModel = try isolatedModel(from: momd)

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
        legacy.setValue(f.referenceDate, forKey: "date")
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
        let migrated = try #require(
            migratedContext.fetch(NSFetchRequest<NSManagedObject>(entityName: "Transaction")).first,
            "the seeded transaction did not survive migration from \(momName)"
        )

        #expect(migrated.value(forKey: "amount") as? Double == 99.0)
        #expect(migrated.value(forKey: "emoji") as? String == nil)
        #expect(migrated.value(forKey: "icon") as? String == nil)
        #expect(migrated.value(forKey: "imageData") as? Data == nil)
        #expect(migrated.value(forKey: "imageColor") as? String == nil)
        #expect(migrated.value(forKey: "customColor") as? String == nil)
        #expect(migrated.value(forKey: "currency") as? String == nil)
        #expect(migrated.value(forKey: "recurringEndDate") as? Date == nil)
        #expect(migrated.value(forKey: "details") as? String == nil)
    }

    // These cover the chain as it ships TODAY. The V2 XML was edited in place
    // historically, so a store written by the pre-edit build wouldn't match it —
    // but those stores are pre-fork-era and unreachable under the Outlayr bundle,
    // app group, and CloudKit container (docs/decisions/rebrand-identity.md:
    // no user-data migration, a fresh container is provisioned).

    @Test func storeCreatedWithVersion1OpensUnderCurrentModel() throws {
        try assertLightweightMigrationToCurrentModel(fromMomNamed: "MainModel")
    }

    @Test func storeCreatedWithVersion2OpensUnderCurrentModel() throws {
        try assertLightweightMigrationToCurrentModel(fromMomNamed: "MainModel 2")
    }

    @Test func storeCreatedWithVersion3OpensUnderCurrentModel() throws {
        try assertLightweightMigrationToCurrentModel(fromMomNamed: "MainModel 3")
    }

    @Test func storeCreatedWithVersion4OpensUnderCurrentModel() throws {
        try assertLightweightMigrationToCurrentModel(fromMomNamed: "MainModel 4")
    }

    @Test func storeCreatedWithVersion5OpensUnderCurrentModel() throws {
        try assertLightweightMigrationToCurrentModel(fromMomNamed: "MainModel 5")
    }
}
