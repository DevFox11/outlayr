//
//  BackButton.swift
//  Outlayr
//
//  Created by Yumi on 2023-10-24.
//

import SwiftUI

struct BackButton: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ToolbarButton(systemName: "chevron.left") {
            dismiss()
        }
    }
}
