//
//  TransactionIdentitySelectionTests.swift
//  OutlayrTests
//
//  The reducer contract for the transaction identity picker: photo/emoji/icon
//  are mutually exclusive, only catalog-resolvable icon names are storable, and
//  the custom-color override restores cleanly to auto.
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
        XCTAssertNil(selection.customColor)
        XCTAssertNil(selection.effectiveColor)
    }

    func testSelectingEmojiClearsIconAndPhoto() {
        var selection = TransactionIdentitySelection()
        selection.selectIcon("shopping-cart-01")
        selection.selectEmoji("🍿")
        XCTAssertEqual(selection.symbol, .emoji("🍿"))
    }

    func testSelectingIconClearsEmojiAndPhoto() {
        var selection = TransactionIdentitySelection()
        selection.selectPhoto(imageData: sampleData, imageColor: "#112233")
        XCTAssertTrue(selection.selectIcon("shopping-cart-01"))
        XCTAssertEqual(selection.symbol, .icon("shopping-cart-01"))
    }

    func testSelectingPhotoClearsIconAndEmoji() {
        var selection = TransactionIdentitySelection()
        selection.selectEmoji("🍿")
        selection.selectPhoto(imageData: sampleData, imageColor: "#112233")
        XCTAssertEqual(selection.symbol, .photo(imageData: sampleData, imageColor: "#112233"))
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

    func testCustomColorOverridesThenRestoresToAuto() {
        var selection = TransactionIdentitySelection()
        selection.selectPhoto(imageData: sampleData, imageColor: "#ABCDEF")
        XCTAssertEqual(selection.effectiveColor, "#ABCDEF")

        selection.overrideColor("#FF0000")
        XCTAssertEqual(selection.customColor, "#FF0000")
        XCTAssertEqual(selection.effectiveColor, "#FF0000")

        selection.restoreAutoColor()
        XCTAssertNil(selection.customColor)
        XCTAssertEqual(selection.effectiveColor, "#ABCDEF")
    }

    func testChoosingANewSymbolResetsTheColorOverride() {
        var selection = TransactionIdentitySelection()
        selection.selectPhoto(imageData: sampleData, imageColor: "#ABCDEF")
        selection.overrideColor("#FF0000")
        selection.selectEmoji("🍕")
        XCTAssertNil(selection.customColor)
    }

    func testEmojiAndIconHaveNoAutoColor() {
        var selection = TransactionIdentitySelection()
        selection.selectEmoji("🍕")
        XCTAssertNil(selection.effectiveColor)
        selection.selectIcon("coins-01")
        XCTAssertNil(selection.effectiveColor)
    }

    func testClearResetsEverything() {
        var selection = TransactionIdentitySelection()
        selection.selectPhoto(imageData: sampleData, imageColor: "#ABCDEF")
        selection.overrideColor("#FF0000")
        selection.clear()
        XCTAssertTrue(selection.isEmpty)
        XCTAssertNil(selection.customColor)
    }

    // MARK: - apply(to:)

    func testApplyPhotoWritesImageFieldsAndClearsSymbols() {
        let context = makeContext()
        let transaction = makeTransaction(in: context, amount: 1, date: referenceDate)
        transaction.icon = "sale-tag-01"
        transaction.emoji = "🎁"

        var selection = TransactionIdentitySelection()
        selection.selectPhoto(imageData: sampleData, imageColor: "#123456")
        selection.apply(to: transaction)

        XCTAssertEqual(transaction.imageData, sampleData)
        XCTAssertEqual(transaction.imageColor, "#123456")
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
        XCTAssertNil(transaction.imageColor)
    }

    func testApplyWritesAndClearsCustomColor() {
        let context = makeContext()
        let transaction = makeTransaction(in: context, amount: 1, date: referenceDate)

        var selection = TransactionIdentitySelection()
        selection.selectPhoto(imageData: sampleData, imageColor: "#123456")
        selection.overrideColor("#FF0000")
        selection.apply(to: transaction)
        XCTAssertEqual(transaction.customColor, "#FF0000")

        selection.restoreAutoColor()
        selection.apply(to: transaction)
        XCTAssertNil(transaction.customColor)
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
        photoTx.imageColor = "#654321"
        photoTx.customColor = "#0000FF"
        let restored = TransactionIdentitySelection(transaction: photoTx)
        XCTAssertEqual(restored.symbol, .photo(imageData: sampleData, imageColor: "#654321"))
        XCTAssertEqual(restored.customColor, "#0000FF")
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
        transaction.imageColor = "#123456"

        var selection = TransactionIdentitySelection()
        selection.selectEmoji("🎁")
        selection.apply(to: transaction)

        XCTAssertEqual(transaction.emoji, "🎁")
        XCTAssertNil(transaction.icon)
        XCTAssertNil(transaction.imageData)
        XCTAssertNil(transaction.imageColor)
    }

    func testApplyNoneClearsEverything() {
        let context = makeContext()
        let transaction = makeTransaction(in: context, amount: 1, date: referenceDate)
        transaction.icon = "sale-tag-01"
        transaction.emoji = "🎁"
        transaction.imageData = sampleData
        transaction.imageColor = "#123456"
        transaction.customColor = "#FF0000"

        let selection = TransactionIdentitySelection()
        selection.apply(to: transaction)

        XCTAssertNil(transaction.icon)
        XCTAssertNil(transaction.emoji)
        XCTAssertNil(transaction.imageData)
        XCTAssertNil(transaction.imageColor)
        XCTAssertNil(transaction.customColor)
    }

    /// The lifecycle contract the #38 form depends on: whatever a user picks,
    /// `apply(to:)` then `init(transaction:)` reproduces the same selection.
    func testLifecycleRoundTripReproducesEachSymbol() {
        let context = makeContext()

        var photo = TransactionIdentitySelection()
        photo.selectPhoto(imageData: sampleData, imageColor: "#654321")
        photo.overrideColor("#0000FF")
        let photoTx = makeTransaction(in: context, amount: 1, date: referenceDate)
        photo.apply(to: photoTx)
        let photoBack = TransactionIdentitySelection(transaction: photoTx)
        XCTAssertEqual(photoBack.symbol, .photo(imageData: sampleData, imageColor: "#654321"))
        XCTAssertEqual(photoBack.customColor, "#0000FF")

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
