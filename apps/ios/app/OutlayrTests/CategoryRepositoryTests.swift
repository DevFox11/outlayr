//
//  CategoryRepositoryTests.swift
//  OutlayrTests
//
//  Coverage for CategoryRepository: validation logic (categoryCheck /
//  categoryCheckEdit), fetch-request predicates, and income-mode scoping.
//

import CoreData
import Testing
@testable import Outlayr

@Suite("CategoryRepository")
struct CategoryRepositoryTests {

    // MARK: - categoryCheck validation (new category)

    @Test("incomplete when both name and symbol are blank")
    func check_bothBlank_returnsIncomplete() {
        let f = RepositoryFixture()
        let result = f.controller.categories.categoryCheck(name: "", icon: "", emoji: "", income: false)
        #expect(result.error == .incomplete)
    }

    @Test("missingName when name is blank but icon is supplied")
    func check_blankName_withIcon_returnsMissingName() {
        let f = RepositoryFixture()
        let result = f.controller.categories.categoryCheck(name: "  ", icon: "sale-tag-01", emoji: "", income: false)
        #expect(result.error == .missingName)
    }

    @Test("missingName when name is blank but emoji is supplied")
    func check_blankName_withEmoji_returnsMissingName() {
        let f = RepositoryFixture()
        let result = f.controller.categories.categoryCheck(name: " ", icon: "", emoji: "🍕", income: false)
        #expect(result.error == .missingName)
    }

    @Test("missingIcon when name is non-blank but no symbol provided")
    func check_noSymbol_returnsMissingIcon() {
        let f = RepositoryFixture()
        let result = f.controller.categories.categoryCheck(name: "Groceries", icon: "", emoji: "", income: false)
        #expect(result.error == .missingIcon)
    }

    @Test("duplicate when both name and icon are already taken by a sibling")
    func check_nameAndIconTaken_returnsDuplicate() {
        let f = RepositoryFixture()
        f.makeCategory(name: "Food", icon: "sale-tag-01", order: 0)
        f.save()

        let result = f.controller.categories.categoryCheck(name: "Food", icon: "sale-tag-01", emoji: "", income: false)
        #expect(result.error == .duplicate)
    }

    @Test("duplicateIcon when only the icon is taken")
    func check_onlyIconTaken_returnsDuplicateIcon() {
        let f = RepositoryFixture()
        f.makeCategory(name: "Food", icon: "sale-tag-01", order: 0)
        f.save()

        let result = f.controller.categories.categoryCheck(name: "Drinks", icon: "sale-tag-01", emoji: "", income: false)
        #expect(result.error == .duplicateIcon)
    }

    @Test("duplicateName when only the name is taken")
    func check_onlyNameTaken_returnsDuplicateName() {
        let f = RepositoryFixture()
        f.makeCategory(name: "Food", icon: "sale-tag-01", order: 0)
        f.save()

        let result = f.controller.categories.categoryCheck(name: "Food", icon: "tag-02", emoji: "", income: false)
        #expect(result.error == .duplicateName)
    }

    @Test("duplicateEmoji when the emoji is taken (independent of icon namespace)")
    func check_emojiTaken_returnsDuplicateEmoji() {
        let f = RepositoryFixture()
        // A category with no icon but a stored emoji.
        let cat = f.makeCategory(name: "Pizza", icon: nil, order: 0)
        cat.emoji = "🍕"
        f.save()

        // Different name, no icon, same emoji → emoji collision.
        let result = f.controller.categories.categoryCheck(name: "Margherita", icon: "", emoji: "🍕", income: false)
        #expect(result.error == .duplicateEmoji)
    }

    @Test("none + correct next order when name and symbol are fresh")
    func check_fresh_returnsNoneAndNextOrder() {
        let f = RepositoryFixture()
        f.makeCategory(name: "Food",      icon: "sale-tag-01", order: 0)
        f.makeCategory(name: "Transport", icon: "car-01",      order: 5)
        f.save()

        let result = f.controller.categories.categoryCheck(name: "Bills", icon: "tag-02", emoji: "", income: false)
        #expect(result.error == .none)
        #expect(result.order == 6)  // last sibling order (5) + 1
    }

    @Test("collision check is scoped to income mode — expense names don't block income side")
    func check_incomeAndExpenseNamesAreIsolated() {
        let f = RepositoryFixture()
        f.makeCategory(name: "Salary", icon: "sale-tag-01", income: true, order: 0)
        f.save()

        // Same name and icon on expense side → no collision.
        let result = f.controller.categories.categoryCheck(name: "Salary", icon: "sale-tag-01", emoji: "", income: false)
        #expect(result.error == .none)
    }

    // MARK: - categoryCheckEdit validation (existing category)

    @Test("edit: allows blank symbol when category never had one (legacy row)")
    func checkEdit_legacyNoSymbol_allowsBlank() {
        let f = RepositoryFixture()
        let legacy = f.makeCategory(name: "Legacy", icon: nil, order: 0)
        legacy.emoji = nil  // no symbol at all
        f.save()

        // Only renaming — no symbol supplied — must be allowed.
        let result = f.controller.categories.categoryCheckEdit(name: "Renamed", icon: "", emoji: "", toEdit: legacy)
        #expect(result.error == .none)
    }

    @Test("edit: requires symbol when category previously had an icon")
    func checkEdit_hadIcon_requiresSymbol() {
        let f = RepositoryFixture()
        let cat = f.makeCategory(name: "Food", icon: "sale-tag-01", order: 0)
        f.save()

        let result = f.controller.categories.categoryCheckEdit(name: "Renamed", icon: "", emoji: "", toEdit: cat)
        #expect(result.error == .missingIcon)
    }

    @Test("edit: excludes self from duplicate check so a round-trip rename is valid")
    func checkEdit_selfExcludedFromCollision() {
        let f = RepositoryFixture()
        let cat = f.makeCategory(name: "Food", icon: "sale-tag-01", order: 0)
        f.save()

        // Saving the same name+icon back should not collide with itself.
        let result = f.controller.categories.categoryCheckEdit(name: "Food", icon: "sale-tag-01", emoji: "", toEdit: cat)
        #expect(result.error == .none)
    }

    @Test("edit: still detects collision against other siblings")
    func checkEdit_detectsCollisionWithSibling() {
        let f = RepositoryFixture()
        let cat1 = f.makeCategory(name: "Food",  icon: "sale-tag-01", order: 0)
        f.makeCategory(name: "Drinks", icon: "tag-02",      order: 1)
        f.save()

        // Renaming Food to Drinks (name already taken by a sibling).
        let result = f.controller.categories.categoryCheckEdit(name: "Drinks", icon: "different-icon", emoji: "", toEdit: cat1)
        #expect(result.error == .duplicateName)
    }

    // MARK: - Fetch requests

    @Test("fetchRequestForTopLevelCategories excludes child categories")
    func topLevel_excludesChildren() throws {
        let f = RepositoryFixture()
        let parent = f.makeCategory(name: "Food",   order: 0)
        let child  = f.makeCategory(name: "Coffee", order: 1)
        child.parent = parent
        try f.context.save()

        let results = try f.context.fetch(f.controller.categories.fetchRequestForTopLevelCategories(income: false))
        #expect(results.contains(parent))
        #expect(!results.contains(child))
    }

    @Test("fetchRequestForTopLevelCategories is scoped to income mode")
    func topLevel_scopedToIncomeMode() throws {
        let f = RepositoryFixture()
        let expense = f.makeCategory(name: "Food",   income: false, order: 0)
        let income  = f.makeCategory(name: "Salary", income: true,  order: 0)
        try f.context.save()

        let expenseResults = try f.context.fetch(f.controller.categories.fetchRequestForTopLevelCategories(income: false))
        let incomeResults  = try f.context.fetch(f.controller.categories.fetchRequestForTopLevelCategories(income: true))

        #expect(expenseResults.contains(expense))
        #expect(!expenseResults.contains(income))
        #expect(incomeResults.contains(income))
        #expect(!incomeResults.contains(expense))
    }

    @Test("getAllCategories filters by income flag and returns results sorted by order")
    func getAllCategories_incomeFilterAndOrder() {
        let f = RepositoryFixture()
        f.makeCategory(name: "Salary",    income: true,  order: 0)
        f.makeCategory(name: "Transport", income: false, order: 1)
        f.makeCategory(name: "Food",      income: false, order: 0)
        f.save()

        let expenses = f.controller.categories.getAllCategories(income: false)
        let income   = f.controller.categories.getAllCategories(income: true)

        #expect(expenses.map(\.wrappedName) == ["Food", "Transport"])
        #expect(income.count == 1)
        #expect(income[0].wrappedName == "Salary")
    }

    @Test("fetchRequestForCategoriesMigration returns all categories when income is nil")
    func migrationFetch_noFilter_returnsAll() throws {
        let f = RepositoryFixture()
        f.makeCategory(name: "Food",   income: false, order: 0)
        f.makeCategory(name: "Salary", income: true,  order: 0)
        try f.context.save()

        let all = try f.context.fetch(f.controller.categories.fetchRequestForCategoriesMigration(income: nil))
        #expect(all.count == 2)
    }
}
