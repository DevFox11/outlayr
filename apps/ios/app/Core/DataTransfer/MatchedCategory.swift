//
//  MatchedCategory.swift
//  Outlayr
//
//  Created by Rafael Soh on 21/8/23.
//

import ConfettiSwiftUI
import Foundation
import SwiftUI
import UIKit
import UniformTypeIdentifiers

struct MatchedCategory: Hashable {
    let excelValue: String
    var income: Bool
    var category: Category?

    mutating func toggleIncome() {
        income = !income
    }
}
