//
//  TransactionIdentitySelectionTests.swift
//  OutlayrTests
//
//  The reducer contract for the transaction identity picker: photo/emoji/icon
//  are mutually exclusive, only catalog-resolvable icon names are storable, and
//  the custom-color override restores cleanly to auto.
//

import CoreData
import Testing

@testable import Outlayr

struct TransactionIdentitySelectionTests {
    private let sampleData = Data([0x01, 0x02, 0x03, 0x04])

    private func makeContext() -> NSManagedObjectContext {
        var f = CharacterizationFixture()
        return f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults()).container.viewContext
    }

    @Test func freshSelectionIsEmpty() {
        let selection = TransactionIdentitySelection()
        #expect(selection.isEmpty)
        #expect(selection.symbol == .none)
        #expect(selection.customColor == nil)
        #expect(selection.effectiveColor == nil)
    }

    @Test func selectingEmojiClearsIconAndPhoto() {
        var selection = TransactionIdentitySelection()
        selection.selectIcon("shopping-cart-01")
        selection.selectEmoji("🍿")
        #expect(selection.symbol == .emoji("🍿"))
    }

    @Test func selectingIconClearsEmojiAndPhoto() {
        var selection = TransactionIdentitySelection()
        selection.selectPhoto(imageData: sampleData, imageColor: "#112233")
        #expect(selection.selectIcon("shopping-cart-01"))
        #expect(selection.symbol == .icon("shopping-cart-01"))
    }

    @Test func selectingPhotoClearsIconAndEmoji() {
        var selection = TransactionIdentitySelection()
        selection.selectEmoji("🍿")
        selection.selectPhoto(imageData: sampleData, imageColor: "#112233")
        #expect(selection.symbol == .photo(imageData: sampleData, imageColor: "#112233"))
    }

    @Test func unresolvableIconNameIsRejectedAndLeavesSelectionUnchanged() {
        var selection = TransactionIdentitySelection()
        selection.selectEmoji("🍿")
        #expect(selection.selectIcon("not-a-real-icon") == false)
        #expect(selection.symbol == .emoji("🍿"), "a rejected icon must not mutate the selection")
    }

    @Test func validIconNameIsAccepted() {
        var selection = TransactionIdentitySelection()
        #expect(selection.selectIcon("coins-01"))
        #expect(selection.symbol == .icon("coins-01"))
    }

    @Test func customColorOverridesThenRestoresToAuto() {
        var selection = TransactionIdentitySelection()
        selection.selectPhoto(imageData: sampleData, imageColor: "#ABCDEF")
        #expect(selection.effectiveColor == "#ABCDEF")

        selection.overrideColor("#FF0000")
        #expect(selection.customColor == "#FF0000")
        #expect(selection.effectiveColor == "#FF0000")

        selection.restoreAutoColor()
        #expect(selection.customColor == nil)
        #expect(selection.effectiveColor == "#ABCDEF")
    }

    @Test func choosingANewSymbolResetsTheColorOverride() {
        var selection = TransactionIdentitySelection()
        selection.selectPhoto(imageData: sampleData, imageColor: "#ABCDEF")
        selection.overrideColor("#FF0000")
        selection.selectEmoji("🍕")
        #expect(selection.customColor == nil)
    }

    @Test func emojiAndIconHaveNoAutoColor() {
        var selection = TransactionIdentitySelection()
        selection.selectEmoji("🍕")
        #expect(selection.effectiveColor == nil)
        selection.selectIcon("coins-01")
        #expect(selection.effectiveColor == nil)
    }

    @Test func clearResetsEverything() {
        var selection = TransactionIdentitySelection()
        selection.selectPhoto(imageData: sampleData, imageColor: "#ABCDEF")
        selection.overrideColor("#FF0000")
        selection.clear()
        #expect(selection.isEmpty)
        #expect(selection.customColor == nil)
    }

    // MARK: - apply(to:)

    @Test func applyPhotoWritesImageFieldsAndClearsSymbols() {
        var f = CharacterizationFixture()
        let context = makeContext()
        let transaction = f.makeTransaction(in: context, amount: 1, date: f.referenceDate)
        transaction.icon = "sale-tag-01"
        transaction.emoji = "🎁"

        var selection = TransactionIdentitySelection()
        selection.selectPhoto(imageData: sampleData, imageColor: "#123456")
        selection.apply(to: transaction)

        #expect(transaction.imageData == sampleData)
        #expect(transaction.imageColor == "#123456")
        #expect(transaction.icon == nil)
        #expect(transaction.emoji == nil)
    }

    @Test func applyIconWritesIconAndClearsImageAndEmoji() {
        var f = CharacterizationFixture()
        let context = makeContext()
        let transaction = f.makeTransaction(in: context, amount: 1, date: f.referenceDate)
        transaction.imageData = sampleData
        transaction.emoji = "🎁"

        var selection = TransactionIdentitySelection()
        selection.selectIcon("coins-01")
        selection.apply(to: transaction)

        #expect(transaction.icon == "coins-01")
        #expect(transaction.imageData == nil)
        #expect(transaction.emoji == nil)
        #expect(transaction.imageColor == nil)
    }

    @Test func applyWritesAndClearsCustomColor() {
        var f = CharacterizationFixture()
        let context = makeContext()
        let transaction = f.makeTransaction(in: context, amount: 1, date: f.referenceDate)

        var selection = TransactionIdentitySelection()
        selection.selectPhoto(imageData: sampleData, imageColor: "#123456")
        selection.overrideColor("#FF0000")
        selection.apply(to: transaction)
        #expect(transaction.customColor == "#FF0000")

        selection.restoreAutoColor()
        selection.apply(to: transaction)
        #expect(transaction.customColor == nil)
    }

    @Test func initFromTransactionRoundTripsIconEmojiAndPhoto() {
        var f = CharacterizationFixture()
        let context = makeContext()

        let iconTx = f.makeTransaction(in: context, amount: 1, date: f.referenceDate)
        iconTx.icon = "coins-01"
        #expect(TransactionIdentitySelection(transaction: iconTx).symbol == .icon("coins-01"))

        let emojiTx = f.makeTransaction(in: context, amount: 1, date: f.referenceDate)
        emojiTx.emoji = "🍕"
        #expect(TransactionIdentitySelection(transaction: emojiTx).symbol == .emoji("🍕"))

        let photoTx = f.makeTransaction(in: context, amount: 1, date: f.referenceDate)
        photoTx.imageData = sampleData
        photoTx.imageColor = "#654321"
        photoTx.customColor = "#0000FF"
        let restored = TransactionIdentitySelection(transaction: photoTx)
        #expect(restored.symbol == .photo(imageData: sampleData, imageColor: "#654321"))
        #expect(restored.customColor == "#0000FF")
    }

    @Test func initFromTransactionTreatsUnresolvableIconAsAbsent() {
        var f = CharacterizationFixture()
        let context = makeContext()
        let transaction = f.makeTransaction(in: context, amount: 1, date: f.referenceDate)
        transaction.icon = "not-a-real-icon"
        transaction.emoji = "🍕"
        #expect(TransactionIdentitySelection(transaction: transaction).symbol == .emoji("🍕"))
    }

    /// A contradictory legacy row with both a valid icon AND an emoji resolves
    /// icon-first, matching `Transaction.ownSymbol`.
    @Test func initFromTransactionPrefersValidIconOverEmoji() {
        var f = CharacterizationFixture()
        let context = makeContext()
        let transaction = f.makeTransaction(in: context, amount: 1, date: f.referenceDate)
        transaction.icon = "coins-01"
        transaction.emoji = "🍕"
        #expect(TransactionIdentitySelection(transaction: transaction).symbol == .icon("coins-01"))
    }

    @Test func applyEmojiClearsImageAndIconFields() {
        var f = CharacterizationFixture()
        let context = makeContext()
        let transaction = f.makeTransaction(in: context, amount: 1, date: f.referenceDate)
        transaction.icon = "sale-tag-01"
        transaction.imageData = sampleData
        transaction.imageColor = "#123456"

        var selection = TransactionIdentitySelection()
        selection.selectEmoji("🎁")
        selection.apply(to: transaction)

        #expect(transaction.emoji == "🎁")
        #expect(transaction.icon == nil)
        #expect(transaction.imageData == nil)
        #expect(transaction.imageColor == nil)
    }

    @Test func applyNoneClearsEverything() {
        var f = CharacterizationFixture()
        let context = makeContext()
        let transaction = f.makeTransaction(in: context, amount: 1, date: f.referenceDate)
        transaction.icon = "sale-tag-01"
        transaction.emoji = "🎁"
        transaction.imageData = sampleData
        transaction.imageColor = "#123456"
        transaction.customColor = "#FF0000"

        let selection = TransactionIdentitySelection()
        selection.apply(to: transaction)

        #expect(transaction.icon == nil)
        #expect(transaction.emoji == nil)
        #expect(transaction.imageData == nil)
        #expect(transaction.imageColor == nil)
        #expect(transaction.customColor == nil)
    }

    /// The lifecycle contract the #38 form depends on: whatever a user picks,
    /// `apply(to:)` then `init(transaction:)` reproduces the same selection.
    @Test func lifecycleRoundTripReproducesEachSymbol() {
        var f = CharacterizationFixture()
        let context = makeContext()

        var photo = TransactionIdentitySelection()
        photo.selectPhoto(imageData: sampleData, imageColor: "#654321")
        photo.overrideColor("#0000FF")
        let photoTx = f.makeTransaction(in: context, amount: 1, date: f.referenceDate)
        photo.apply(to: photoTx)
        let photoBack = TransactionIdentitySelection(transaction: photoTx)
        #expect(photoBack.symbol == .photo(imageData: sampleData, imageColor: "#654321"))
        #expect(photoBack.customColor == "#0000FF")

        var emoji = TransactionIdentitySelection()
        emoji.selectEmoji("🍕")
        let emojiTx = f.makeTransaction(in: context, amount: 1, date: f.referenceDate)
        emoji.apply(to: emojiTx)
        #expect(TransactionIdentitySelection(transaction: emojiTx) == emoji)

        var icon = TransactionIdentitySelection()
        icon.selectIcon("coins-01")
        let iconTx = f.makeTransaction(in: context, amount: 1, date: f.referenceDate)
        icon.apply(to: iconTx)
        #expect(TransactionIdentitySelection(transaction: iconTx) == icon)
    }
}
