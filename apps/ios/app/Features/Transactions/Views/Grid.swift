//
//  Grid.swift
//  Outlayr
//
//  Created by Rafael Soh on 4/9/23.
//

import Foundation
import CoreData
import Popovers
import SwiftUI
import WidgetKit

struct Grid: Identifiable {
    var id: UUID
    var index: Int
    var transaction: TemplateTransaction?

    init(index: Int) {
        id = UUID()

        let dataController = DataController.shared

        transaction = dataController.getTemplateTransaction(order: index)
        self.index = index
    }
}
