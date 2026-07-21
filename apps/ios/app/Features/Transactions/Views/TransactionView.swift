//
//  TransactionView.swift
//  xpenz
//
//  Created by Rafael Soh on 14/5/22.
//

import Foundation
import CoreData
import Popovers
import SwiftUI

struct TransactionView: View {
    private let toEdit: Transaction?
    private let presetCategory: Category?

    init(toEdit: Transaction? = nil) {
        self.toEdit = toEdit
        presetCategory = nil
    }

    init(category: Category? = nil) {
        toEdit = nil
        presetCategory = category
    }

    var body: some View {
        TransactionFormView(toEdit: toEdit, category: presetCategory)
    }
}

func getDollarOffset(big: CGFloat, small: CGFloat) -> CGFloat {
    let bigFont = UIFont.rounded(ofSize: big, weight: .regular)
    let smallFont = UIFont.rounded(ofSize: small, weight: .light)

    return bigFont.capHeight - smallFont.capHeight - 1
}
