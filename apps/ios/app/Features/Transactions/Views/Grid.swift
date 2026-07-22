//
//  Grid.swift
//  Outlayr
//
//  Created by Rafael Soh on 4/9/23.
//

import Foundation
import SwiftUI

struct Grid: Identifiable {
    var id: UUID
    var index: Int
    var transaction: TemplateTransaction?

    @MainActor
    init(index: Int) {
        id = UUID()
        transaction = DataController.shared.transactions.getTemplateTransaction(order: index)
        self.index = index
    }
}
