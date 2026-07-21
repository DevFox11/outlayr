//
//  AnimatedHorizontalBarGraphMainBudget.swift
//  Outlayr
//

import Foundation
import SwiftUI

struct AnimatedHorizontalBarGraphMainBudget: View {
    @State var showBar: Bool = false
    @AppStorage("animated", store: AppIdentifiers.sharedDefaults) var animated: Bool = true

    var body: some View {
        HStack(spacing: 0) {
            RoundedRectangle(cornerRadius: 11.5, style: .continuous)
                .fill(Color.DarkBackground)
                .frame(width: showBar ? nil : 0, alignment: .leading)

            Spacer(minLength: 0)
        }
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now()) {
                if !animated {
                    showBar = true
                } else {
                    withAnimation(.easeInOut(duration: 0.7)) {
                        showBar = true
                    }
                }
            }
        }
    }
}
