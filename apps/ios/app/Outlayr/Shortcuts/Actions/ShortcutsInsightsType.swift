//
//  GetInsightsIntent.swift
//  Outlayr
//
//  Created by Rafael Soh on 5/8/23.
//

import AppIntents
import Foundation
import SwiftUI

enum ShortcutsInsightsType: String {
    case net, income, spent
}

@available(iOS 16, *)
extension ShortcutsInsightsType: AppEnum {
    static var typeDisplayRepresentation: TypeDisplayRepresentation {
        return TypeDisplayRepresentation(name: "Insights Type")
    }

    static var caseDisplayRepresentations: [ShortcutsInsightsType: DisplayRepresentation] = [
        .net: DisplayRepresentation(title: "net total"),
        .income: DisplayRepresentation(title: "total income"),
        .spent: DisplayRepresentation(title: "total expenditure")
    ]
}
