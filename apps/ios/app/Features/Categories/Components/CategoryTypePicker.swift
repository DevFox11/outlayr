//
//  CategoryTypePicker.swift
//  Outlayr
//

import SwiftUI

/// The floating Expense/Income switcher for the Categories screen's bottom bar.
/// Do not place this in a Form row: the `.tabs` style is sized for toolbars —
/// it overflows the cell and its oversized frame swallows neighbours' taps.
struct CategoryTypePicker: View {
    @Binding var income: Bool

    var body: some View {
        if #available(iOS 27.0, *) {
            basePicker.pickerStyle(.tabs)
        } else {
            basePicker.pickerStyle(.segmented)
        }
    }

    private var basePicker: some View {
        Picker("Category Type", selection: $income) {
            Text("Expense").tag(false)
            Text("Income").tag(true)
        }
    }
}
