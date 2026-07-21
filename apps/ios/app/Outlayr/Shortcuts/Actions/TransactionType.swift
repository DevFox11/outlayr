//
//  NewTransactionIntent.swift
//  Outlayr
//
//  Created by Rafael Soh on 23/7/23.
//

import AppIntents
import Foundation
import SwiftUI

enum TransactionType: String {
    case income, expense
}

@available(iOS 16, *)
extension TransactionType: AppEnum {
    static var typeDisplayRepresentation: TypeDisplayRepresentation {
        return TypeDisplayRepresentation(name: "Type")
    }

    static var caseDisplayRepresentations: [TransactionType: DisplayRepresentation] = [
        .income: DisplayRepresentation(title: "income",
                                       image: .init(systemName: "plus.square.fill")),
        .expense: DisplayRepresentation(title: "expense",
                                        image: .init(systemName: "minus.square.fill"))
    ]
}
