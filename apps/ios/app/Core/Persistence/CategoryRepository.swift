//
//  CategoryRepository.swift
//  Outlayr
//

import CoreData
import Foundation

struct CategoryRepository {
    let dataController: DataController

    private var context: NSManagedObjectContext { dataController.container.viewContext }

    private func results<T: NSManagedObject>(for fetchRequest: NSFetchRequest<T>) -> [T] {
        dataController.results(for: fetchRequest)
    }

    func fetchRequestForCategoriesMigration(income: Bool? = nil) -> NSFetchRequest<Category> {
        let itemRequest: NSFetchRequest<Category> = Category.fetchRequest()
        itemRequest.sortDescriptors = [NSSortDescriptor(key: "dateCreated", ascending: true)]

        if let unwrappedIncome = income {
            itemRequest.predicate = NSPredicate(format: "income = %d", unwrappedIncome)
            return itemRequest
        } else {
            return itemRequest
        }
    }

    func fetchRequestForCategories(income: Bool) -> NSFetchRequest<Category> {
        let itemRequest: NSFetchRequest<Category> = Category.fetchRequest()
        itemRequest.sortDescriptors = [NSSortDescriptor(key: "order", ascending: true)]
        itemRequest.predicate = NSPredicate(format: "income = %d", income)
        return itemRequest
    }

    func getAllCategories(income: Bool) -> [Category] {
        let request: NSFetchRequest<Category> = Category.fetchRequest()
        request.sortDescriptors = [NSSortDescriptor(key: "order", ascending: true)]
        request.predicate = NSPredicate(format: "income = %d", income)

        return results(for: request)
    }

    /// Top-level categories only (those without a parent), for the card grid.
    func fetchRequestForTopLevelCategories(income: Bool) -> NSFetchRequest<Category> {
        let request: NSFetchRequest<Category> = Category.fetchRequest()
        request.sortDescriptors = [NSSortDescriptor(key: "order", ascending: true)]
        request.predicate = NSPredicate(format: "income = %d AND parent == nil", income)
        return request
    }

    @available(iOS 16, *)
    func findCategory(withId id: UUID) throws -> Category {
        let request: NSFetchRequest<Category> = Category.fetchRequest()
        request.fetchLimit = 1
        request.predicate = NSPredicate(format: "id = %@", id as CVarArg)

        do {
            guard let foundCategory = try context.fetch(request).first else {
                throw CustomError.notFound
            }
            return foundCategory
        } catch {
            throw CustomError.notFound
        }
    }

    func categoryCheck(
        name: String,
        icon: String,
        emoji: String,
        income: Bool
    ) -> (error: CategoryError, order: Int64) {
        // "Missing icon" now means no symbol at all: either kind satisfies it.
        let symbolMissing = icon.isEmpty && emoji.isEmpty

        if name.trimmingCharacters(in: .whitespacesAndNewlines) == "" && symbolMissing {
            return (CategoryError.incomplete, 0)
        } else if name.trimmingCharacters(in: .whitespacesAndNewlines) == "" {
            return (CategoryError.missingName, 0)
        } else if symbolMissing {
            return (CategoryError.missingIcon, 0)
        }

        let siblings = results(for: fetchRequestForCategories(income: income))
        return collision(name: name, icon: icon, emoji: emoji, against: siblings)
    }

    func categoryCheckEdit(
        name: String,
        icon: String,
        emoji: String,
        toEdit: Category
    ) -> (error: CategoryError, order: Int64) {
        // A category migrated from the emoji era has no stored icon. Demanding one
        // now would make an unrelated edit — a rename, a recolor — unsavable.
        let symbolRequired = toEdit.icon != nil || toEdit.wrappedEmoji != nil
        let symbolMissing = icon.isEmpty && emoji.isEmpty

        if name.trimmingCharacters(in: .whitespacesAndNewlines) == "" && symbolMissing && symbolRequired {
            return (CategoryError.incomplete, 0)
        } else if name.trimmingCharacters(in: .whitespacesAndNewlines) == "" {
            return (CategoryError.missingName, 0)
        } else if symbolMissing && symbolRequired {
            return (CategoryError.missingIcon, 0)
        }

        let siblings = results(for: fetchRequestForCategories(income: toEdit.income))
            .filter { $0 != toEdit }
        return collision(name: name, icon: icon, emoji: emoji, against: siblings)
    }

    private func collision(
        name: String,
        icon: String,
        emoji: String,
        against siblings: [Category]
    ) -> (error: CategoryError, order: Int64) {
        // Raw stored icons, not `wrappedIcon`: unset and future-version names all
        // resolve to the same fallback glyph, which would fabricate collisions
        // between categories that have no icon in common.
        let iconArray = siblings.compactMap(\.icon)
        let emojiKeys = siblings.compactMap(\.wrappedEmoji).map(\.emojiComparisonKey)
        let nameArray = siblings.map(\.wrappedName)

        // Icons and emoji are independent namespaces: only like collides with like.
        let iconTaken = !icon.isEmpty && iconArray.contains(icon)
        let emojiTaken = !emoji.isEmpty && emojiKeys.contains(emoji.emojiComparisonKey)
        let nameTaken = nameArray.contains(name)

        if (iconTaken || emojiTaken) && nameTaken {
            return (CategoryError.duplicate, 0)
        } else if iconTaken {
            return (CategoryError.duplicateIcon, 0)
        } else if emojiTaken {
            return (CategoryError.duplicateEmoji, 0)
        } else if nameTaken {
            return (CategoryError.duplicateName, 0)
        } else {
            return (CategoryError.none, (siblings.last?.order ?? 0) + 1)
        }
    }
}
