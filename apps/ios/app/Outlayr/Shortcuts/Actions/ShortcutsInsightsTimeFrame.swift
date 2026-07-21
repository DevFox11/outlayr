//
//  GetInsightsIntent.swift
//  Outlayr
//
//  Created by Rafael Soh on 5/8/23.
//

import AppIntents
import Foundation
import SwiftUI

enum ShortcutsInsightsTimeFrame: Int {
    case day = 1
    case week = 2
    case month = 3
    case year = 4
    case all = 5
}

@available(iOS 16, *)
extension ShortcutsInsightsTimeFrame: AppEnum {
    static var typeDisplayRepresentation: TypeDisplayRepresentation {
        return TypeDisplayRepresentation(name: "Time Frame")
    }

    static var caseDisplayRepresentations: [ShortcutsInsightsTimeFrame: DisplayRepresentation] = [
        .day: DisplayRepresentation(title: "today"),
        .week: DisplayRepresentation(title: "this week"),
        .month: DisplayRepresentation(title: "this month"),
        .year: DisplayRepresentation(title: "this year"),
        .all: DisplayRepresentation(title: "all time")
    ]
}
