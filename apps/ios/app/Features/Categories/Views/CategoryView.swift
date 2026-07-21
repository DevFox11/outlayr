//
//  CategoryView.swift
//  Outlayr
//
//  Created by Rafael Soh on 10/5/22.
//

import CoreData
import SwiftUI
import UIKit

struct CategoryView: View {
    var mode: CategoryViewMode
    @State var income = false

    var body: some View {
        switch mode {
        case .settings:
            CategoryListView(mode: mode, income: $income)
        case .welcome, .transaction:
            NavigationStack {
                CategoryListView(mode: mode, income: $income)
            }
        }
    }
}
