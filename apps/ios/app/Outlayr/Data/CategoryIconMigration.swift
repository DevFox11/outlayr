//
//  CategoryIconMigration.swift
//  Outlayr
//

import Foundation

extension DataController {
    /// Backfills the `icon` attribute for categories created before the emoji→icon
    /// switch. Only categories whose name still matches a suggestion inherit its
    /// icon; everything else keeps `icon == nil` and renders through the fallback
    /// in `wrappedIcon`. Persisting that fallback instead would give every
    /// unmatched category the same stored name and lock them all out of editing
    /// on the duplicate-icon check.
    ///
    /// Runs on every launch rather than behind a one-shot flag: it is idempotent,
    /// and re-running is what heals categories that arrive late from CloudKit,
    /// after a reinstall, or after a failed save.
    ///
    /// Lives outside `DataController` proper because the widget and intent targets
    /// compile that file but not `SuggestedCategory`.
    func migrateCategoryIcons() {
        let categories = results(for: fetchRequestForCategoriesMigration())

        categories.forEach { category in
            guard category.icon == nil,
                  let match = SuggestedCategory.match(name: category.wrappedName, income: category.income)
            else { return }

            category.icon = match.icon
        }

        save()
    }
}
