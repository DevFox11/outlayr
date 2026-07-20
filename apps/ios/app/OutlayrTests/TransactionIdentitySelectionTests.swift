//
//  TransactionIdentitySelectionTests.swift
//  OutlayrTests
//
//  The reducer contract for the transaction identity picker: photo/emoji/icon
//  are mutually exclusive, only catalog-resolvable icon names are storable, and
//  the custom-colour override restores cleanly to auto.
//

import CoreData
import XCTest

@testable import Outlayr

final class TransactionIdentitySelectionTests: CharacterizationTestCase {
    private func makeContext() -> NSManagedObjectContext {
        makeController(now: referenceDate, defaults: makeIsolatedDefaults()).container.viewContext
    }

    private let sampleData = Data([0x01, 0x02, 0x03, 0x04])

    func testFreshSelectionIsEmpty() {
        let selection = TransactionIdentitySelection()
        XCTAssertTrue(selection.isEmpty)
        XCTAssertEqual(selection.symbol, .none)
        XCTAssertNil(selection.customColour)
        XCTAssertNil(selection.effectiveColour)
    }

    func testSelectingEmojiClearsIconAndPhoto() {
        var selection = TransactionIdentitySelection()
        selection.selectIcon("shopping-cart-01")
        selection.selectEmoji("🍿")
        XCTAssertEqual(selection.symbol, .emoji("🍿"))
    }

    func testSelectingIconClearsEmojiAndPhoto() {
        var selection = TransactionIdentitySelection()
        selection.selectPhoto(imageData: sampleData, imageColour: "#112233")
        XCTAssertTrue(selection.selectIcon("shopping-cart-01"))
        XCTAssertEqual(selection.symbol, .icon("shopping-cart-01"))
    }

    func testSelectingPhotoClearsIconAndEmoji() {
        var selection = TransactionIdentitySelection()
        selection.selectEmoji("🍿")
        selection.selectPhoto(imageData: sampleData, imageColour: "#112233")
        XCTAssertEqual(selection.symbol, .photo(imageData: sampleData, imageColour: "#112233"))
    }

    func testUnresolvableIconNameIsRejectedAndLeavesSelectionUnchanged() {
        var selection = TransactionIdentitySelection()
        selection.selectEmoji("🍿")
        XCTAssertFalse(selection.selectIcon("not-a-real-icon"))
        XCTAssertEqual(selection.symbol, .emoji("🍿"), "a rejected icon must not mutate the selection")
    }

    func testValidIconNameIsAccepted() {
        var selection = TransactionIdentitySelection()
        XCTAssertTrue(selection.selectIcon("coins-01"))
        XCTAssertEqual(selection.symbol, .icon("coins-01"))
    }

    func testCustomColourOverridesThenRestoresToAuto() {
        var selection = TransactionIdentitySelection()
        selection.selectPhoto(imageData: sampleData, imageColour: "#ABCDEF")
        XCTAssertEqual(selection.effectiveColour, "#ABCDEF")

        selection.overrideColour("#FF0000")
        XCTAssertEqual(selection.customColour, "#FF0000")
        XCTAssertEqual(selection.effectiveColour, "#FF0000")

        selection.restoreAutoColour()
        XCTAssertNil(selection.customColour)
        XCTAssertEqual(selection.effectiveColour, "#ABCDEF")
    }

    func testChoosingANewSymbolResetsTheColourOverride() {
        var selection = TransactionIdentitySelection()
        selection.selectPhoto(imageData: sampleData, imageColour: "#ABCDEF")
        selection.overrideColour("#FF0000")
        selection.selectEmoji("🍕")
        XCTAssertNil(selection.customColour)
    }

    func testEmojiAndIconHaveNoAutoColour() {
        var selection = TransactionIdentitySelection()
        selection.selectEmoji("🍕")
        XCTAssertNil(selection.effectiveColour)
        selection.selectIcon("coins-01")
        XCTAssertNil(selection.effectiveColour)
    }

    func testClearResetsEverything() {
        var selection = TransactionIdentitySelection()
        selection.selectPhoto(imageData: sampleData, imageColour: "#ABCDEF")
        selection.overrideColour("#FF0000")
        selection.clear()
        XCTAssertTrue(selection.isEmpty)
        XCTAssertNil(selection.customColour)
    }

    // MARK: - apply(to:)

    func testApplyPhotoWritesImageFieldsAndClearsSymbols() {
        let context = makeContext()
        let transaction = makeTransaction(in: context, amount: 1, date: referenceDate)
        transaction.icon = "sale-tag-01"
        transaction.emoji = "🎁"

        var selection = TransactionIdentitySelection()
        selection.selectPhoto(imageData: sampleData, imageColour: "#123456")
        selection.apply(to: transaction)

        XCTAssertEqual(transaction.imageData, sampleData)
        XCTAssertEqual(transaction.imageColour, "#123456")
        XCTAssertNil(transaction.icon)
        XCTAssertNil(transaction.emoji)
    }

    func testApplyIconWritesIconAndClearsImageAndEmoji() {
        let context = makeContext()
        let transaction = makeTransaction(in: context, amount: 1, date: referenceDate)
        transaction.imageData = sampleData
        transaction.emoji = "🎁"

        var selection = TransactionIdentitySelection()
        selection.selectIcon("coins-01")
        selection.apply(to: transaction)

        XCTAssertEqual(transaction.icon, "coins-01")
        XCTAssertNil(transaction.imageData)
        XCTAssertNil(transaction.emoji)
        XCTAssertNil(transaction.imageColour)
    }

    func testApplyWritesAndClearsCustomColour() {
        let context = makeContext()
        let transaction = makeTransaction(in: context, amount: 1, date: referenceDate)

        var selection = TransactionIdentitySelection()
        selection.selectPhoto(imageData: sampleData, imageColour: "#123456")
        selection.overrideColour("#FF0000")
        selection.apply(to: transaction)
        XCTAssertEqual(transaction.customColour, "#FF0000")

        selection.restoreAutoColour()
        selection.apply(to: transaction)
        XCTAssertNil(transaction.customColour)
    }

    func testInitFromTransactionRoundTripsIconEmojiAndPhoto() {
        let context = makeContext()

        let iconTx = makeTransaction(in: context, amount: 1, date: referenceDate)
        iconTx.icon = "coins-01"
        XCTAssertEqual(TransactionIdentitySelection(transaction: iconTx).symbol, .icon("coins-01"))

        let emojiTx = makeTransaction(in: context, amount: 1, date: referenceDate)
        emojiTx.emoji = "🍕"
        XCTAssertEqual(TransactionIdentitySelection(transaction: emojiTx).symbol, .emoji("🍕"))

        let photoTx = makeTransaction(in: context, amount: 1, date: referenceDate)
        photoTx.imageData = sampleData
        photoTx.imageColour = "#654321"
        photoTx.customColour = "#0000FF"
        let restored = TransactionIdentitySelection(transaction: photoTx)
        XCTAssertEqual(restored.symbol, .photo(imageData: sampleData, imageColour: "#654321"))
        XCTAssertEqual(restored.customColour, "#0000FF")
    }

    func testInitFromTransactionTreatsUnresolvableIconAsAbsent() {
        let context = makeContext()
        let transaction = makeTransaction(in: context, amount: 1, date: referenceDate)
        transaction.icon = "not-a-real-icon"
        transaction.emoji = "🍕"
        XCTAssertEqual(TransactionIdentitySelection(transaction: transaction).symbol, .emoji("🍕"))
    }

    /// A contradictory legacy row with both a valid icon AND an emoji resolves
    /// icon-first, matching `Transaction.ownSymbol`.
    func testInitFromTransactionPrefersValidIconOverEmoji() {
        let context = makeContext()
        let transaction = makeTransaction(in: context, amount: 1, date: referenceDate)
        transaction.icon = "coins-01"
        transaction.emoji = "🍕"
        XCTAssertEqual(TransactionIdentitySelection(transaction: transaction).symbol, .icon("coins-01"))
    }

    func testApplyEmojiClearsImageAndIconFields() {
        let context = makeContext()
        let transaction = makeTransaction(in: context, amount: 1, date: referenceDate)
        transaction.icon = "sale-tag-01"
        transaction.imageData = sampleData
        transaction.imageColour = "#123456"

        var selection = TransactionIdentitySelection()
        selection.selectEmoji("🎁")
        selection.apply(to: transaction)

        XCTAssertEqual(transaction.emoji, "🎁")
        XCTAssertNil(transaction.icon)
        XCTAssertNil(transaction.imageData)
        XCTAssertNil(transaction.imageColour)
    }

    func testApplyNoneClearsEverything() {
        let context = makeContext()
        let transaction = makeTransaction(in: context, amount: 1, date: referenceDate)
        transaction.icon = "sale-tag-01"
        transaction.emoji = "🎁"
        transaction.imageData = sampleData
        transaction.imageColour = "#123456"
        transaction.customColour = "#FF0000"

        let selection = TransactionIdentitySelection()
        selection.apply(to: transaction)

        XCTAssertNil(transaction.icon)
        XCTAssertNil(transaction.emoji)
        XCTAssertNil(transaction.imageData)
        XCTAssertNil(transaction.imageColour)
        XCTAssertNil(transaction.customColour)
    }

    /// The lifecycle contract the #38 form depends on: whatever a user picks,
    /// `apply(to:)` then `init(transaction:)` reproduces the same selection.
    func testLifecycleRoundTripReproducesEachSymbol() {
        let context = makeContext()

        var photo = TransactionIdentitySelection()
        photo.selectPhoto(imageData: sampleData, imageColour: "#654321")
        photo.overrideColour("#0000FF")
        let photoTx = makeTransaction(in: context, amount: 1, date: referenceDate)
        photo.apply(to: photoTx)
        let photoBack = TransactionIdentitySelection(transaction: photoTx)
        XCTAssertEqual(photoBack.symbol, .photo(imageData: sampleData, imageColour: "#654321"))
        XCTAssertEqual(photoBack.customColour, "#0000FF")

        var emoji = TransactionIdentitySelection()
        emoji.selectEmoji("🍕")
        let emojiTx = makeTransaction(in: context, amount: 1, date: referenceDate)
        emoji.apply(to: emojiTx)
        XCTAssertEqual(TransactionIdentitySelection(transaction: emojiTx), emoji)

        var icon = TransactionIdentitySelection()
        icon.selectIcon("coins-01")
        let iconTx = makeTransaction(in: context, amount: 1, date: referenceDate)
        icon.apply(to: iconTx)
        XCTAssertEqual(TransactionIdentitySelection(transaction: iconTx), icon)
    }
}
