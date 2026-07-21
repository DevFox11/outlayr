//
//  DropViewDelegate.swift
//  Outlayr
//
//  Created by Rafael Soh on 4/9/23.
//

import Foundation
import SwiftUI

struct DropViewDelegate: DropDelegate {
    var grid: Grid
    var gridData: GridViewModel

    func performDrop(info _: DropInfo) -> Bool {
        gridData.updateIndices()
        gridData.currentGrid = nil
        gridData.dragging = false
        return true
    }

    func dropEntered(info _: DropInfo) {
        gridData.dragging = true

        if let unwrapped = gridData.currentGrid {
            if unwrapped.transaction == nil {
                return
            }
        }

        let fromIndex = gridData.gridItems.firstIndex { grid -> Bool in
            grid.id == gridData.currentGrid?.id
        } ?? 0

        let toIndex = gridData.gridItems.firstIndex { grid -> Bool in
            grid.id == self.grid.id
        } ?? 0

        if fromIndex != toIndex {
            withAnimation(.easeIn(duration: 0.2)) {
                let fromGrid = gridData.gridItems[fromIndex]
                gridData.gridItems[fromIndex] = gridData.gridItems[toIndex]
                gridData.gridItems[toIndex] = fromGrid
            }
        }
    }

    func dropUpdated(info _: DropInfo) -> DropProposal? {
        return DropProposal(operation: .move)
    }
}
