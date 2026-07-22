//
//  GridViewModel.swift
//  Outlayr
//
//  Created by Rafael Soh on 4/9/23.
//

import Foundation
import SwiftUI

@MainActor
@Observable
class GridViewModel {
    var currentGrid: Grid?
    var dragging = false

    var gridItems = [
        Grid(index: 0),
        Grid(index: 1),
        Grid(index: 2),
        Grid(index: 3)
    ]

    func reset() {
        withAnimation {
            gridItems = [
                Grid(index: 0),
                Grid(index: 1),
                Grid(index: 2),
                Grid(index: 3)
            ]
        }
    }

    func updateIndices() {
        let dataController = DataController.shared
        for (index, element) in gridItems.enumerated() {
            if let transaction = element.transaction {
                transaction.order = Int16(index)
            }
        }
        try? dataController.save()
    }
}
