//
//  NewTransactionIntent.swift
//  Outlayr
//
//  Created by Rafael Soh on 23/7/23.
//

import AppIntents
import Foundation
import SwiftUI

enum RepeatType: String {
    case daily, weekly, monthly
}

@available(iOS 16, *)
extension RepeatType: AppEnum {
    static var typeDisplayRepresentation: TypeDisplayRepresentation {
        return TypeDisplayRepresentation(name: "Frequency")
    }

    static var caseDisplayRepresentations: [RepeatType: DisplayRepresentation] = [
        .daily: DisplayRepresentation(title: "Daily"),
        .weekly: DisplayRepresentation(title: "Weekly"),
        .monthly: DisplayRepresentation(title: "Monthly")
    ]
}
