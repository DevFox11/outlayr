//
//  CategoryAlerts.swift
//  Outlayr
//

import SwiftUI

extension CategoryError {
    var alertMessage: LocalizedStringKey? {
        switch self {
        case .none: return nil
        case .incomplete: return "Please choose an icon or emoji, and a name."
        case .missingIcon: return "Please choose an icon or emoji for the category."
        case .missingName: return "Please enter a name for this category."
        case .duplicate: return "A category with this symbol and name already exists."
        case .duplicateIcon: return "Another category already uses this icon."
        case .duplicateEmoji: return "Another category already uses this emoji."
        case .duplicateName: return "Another category already uses this name."
        }
    }
}
