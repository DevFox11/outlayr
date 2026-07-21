//
//  BudgetInsightsIntent.swift
//  Outlayr
//
//  Created by Rafael Soh on 6/8/23.
//

import AppIntents
import Foundation
import SwiftUI

enum ShortcutsBudgetsType: String {
    case overall, category
}

@available(iOS 16, *)
extension ShortcutsBudgetsType: AppEnum {
    static var typeDisplayRepresentation: TypeDisplayRepresentation {
        return TypeDisplayRepresentation(name: "Budget Type")
    }

    static var caseDisplayRepresentations: [ShortcutsBudgetsType: DisplayRepresentation] = [
        .overall: DisplayRepresentation(title: "overall budget"),
        .category: DisplayRepresentation(title: "categorical budget")
    ]
}
