//
//  SettingsQuickAddWidgetView.swift
//  Outlayr
//
//  Created by Rafael Soh on 4/9/23.
//

import Foundation
import CoreData
import Popovers
import SwiftUI
import WidgetKit

struct SettingsQuickAddWidgetView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 10) {
            Text("Quick Add Widget")
                .font(.system(size: 20, weight: .semibold, design: .rounded))
                .foregroundStyle(Color.PrimaryText)
                .frame(maxWidth: .infinity)
                .overlay(alignment: .leading) {
                    Button {
                        dismiss()
                    } label: {
                        Circle()
                            .fill(Color.SecondaryBackground)
                            .frame(width: 30, height: 30)
                            .overlay {
                                Image(systemName: "chevron.left")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundStyle(Color.SubtitleText)
                            }
                    }
                }
                .padding(.bottom, 40)

            SettingsQuickAddWidgetDraggingView()
        }
        .navigationBarBackButtonHidden(true)
        .navigationBarTitle("")
        .navigationBarHidden(true)
        .padding(20)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Color.PrimaryBackground)
    }
}
