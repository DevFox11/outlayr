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

    init(index: Int) {
        id = UUID()

        let dataController = DataController.shared

        transaction = dataController.transactions.getTemplateTransaction(order: index)
        self.index = index
    }
}
