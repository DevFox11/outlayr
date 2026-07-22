//
//  AppLockView.swift
//  xpenz
//
//  Created by Rafael Soh on 20/5/22.
//

import Foundation
import SwiftUI

struct AppLockView: View {
    @Environment(AppLockViewModel.self) private var appLockVM

    var body: some View {
        VStack(spacing: 15) {
            Image(systemName: "lock.fill")
                .scaledFont(65)
                .foregroundStyle(Color.DarkIcon.opacity(0.7))

            Text("App Locked")
                .scaledFont(28, weight: .semibold, design: .rounded)
                .foregroundStyle(Color.PrimaryText)
                .padding(.bottom, 30)

            Button {
                Task { await appLockVM.appLockValidation() }
            } label: {
                HStack {
                    Image(systemName: "faceid")

                    Text("Unlock App")
                }
                .scaledFont(20, weight: .medium, design: .rounded)
                .foregroundStyle(Color.PrimaryText)
                .padding(.horizontal, 40)
                .padding(.vertical, 15)
                .overlay {
                    RoundedRectangle(cornerRadius: 13)
                        .stroke(Color.Outline)
                }
            }

            if appLockVM.enrollmentError {
                Text("Please re-enable Face ID access in the Settings app to unlock application.")
                    .scaledFont(15, weight: .regular, design: .rounded)
                    .foregroundStyle(Color.SubtitleText)
                    .multilineTextAlignment(.center)
            } else if let authError = appLockVM.authError {
                Text(authError)
                    .scaledFont(15, weight: .regular, design: .rounded)
                    .foregroundStyle(Color.AlertRed)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(.horizontal, 30)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.PrimaryBackground)
    }
}
