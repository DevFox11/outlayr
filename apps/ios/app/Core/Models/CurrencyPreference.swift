//
//  CurrencyPreference.swift
//  Outlayr
//
//  Created by Rafael Soh on 5/9/22.
//

import Foundation

/// Single source of truth for the global currency preference: its storage key
/// and the fallback chain used everywhere a currency code must be resolved.
enum CurrencyPreference {
    static let storageKey = DefaultsKey.currency

    static func resolve(override: String? = nil) -> String {
        override
            ?? AppIdentifiers.sharedDefaults?.string(forKey: storageKey)
            ?? Locale.current.currency?.identifier
            ?? "USD"
    }
}
