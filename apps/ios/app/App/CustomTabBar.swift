//
//  CustomTabBar.swift
//  xpenz
//
//  Created by Rafael Soh on 20/5/22.
//

import Foundation
import CoreData
import SwiftUI

struct CustomTabBar: View {
    @Environment(AppLockViewModel.self) private var appLockVM
    @Binding var currentTab: String
    var topEdge: CGFloat
    var bottomEdge: CGFloat
    @State var addTransaction: Bool = false

    @State var checkingFace: Bool = false

    @FetchRequest(sortDescriptors: []) private var transactions: FetchedResults<Transaction>

    @State var count = 0
    @Binding var counter: Int

    var launchAdd: Bool

    @AppStorage(DefaultsKey.confetti, store: AppIdentifiers.sharedDefaults) var confetti: Bool = false
    @AppStorage(DefaultsKey.firstTransactionViewLaunch, store: AppIdentifiers.sharedDefaults) var firstLaunch: Bool = true

    @State var animate = false

    private var isZoomed: Bool {
        UIScreen.main.scale != UIScreen.main.nativeScale
    }

    var body: some View {
        HStack(spacing: 4) {
            TabButton(image: "Log", zoomed: isZoomed, currentTab: $currentTab)

            TabButton(image: "Insights", zoomed: isZoomed, currentTab: $currentTab)

            ZStack {
                RoundedRectangle(cornerRadius: 28, style: .continuous).fill(Color.DarkBackground.opacity(0.6))
                    .frame(width: 95, height: 68)
                    .opacity(self.animate ? 0 : 1)
                    .scaleEffect(self.animate ? 1 : 0.4)

                RoundedRectangle(cornerRadius: 20.5, style: .continuous).fill(Color.DarkBackground.opacity(0.8))
                    .frame(width: 80, height: 53)
                    .opacity(self.animate ? 0 : 1)
                    .scaleEffect(self.animate ? 1 : 0.6)

                Button {
                    let impactMed = UIImpactFeedbackGenerator(style: .light)
                    impactMed.impactOccurred()

                    addTransaction = true

                } label: {
                    Image(systemName: "plus")
                }
                .buttonStyle(MyButtonStyle())
                .padding(15)
            }
            .onAppear {
                if transactions.isEmpty {
                    withAnimation(.easeInOut(duration: 1.9).repeatForever(autoreverses: false)) {
                        self.animate.toggle()
                    }
                }
            }
            .accessibilityLabel("Add New Transaction")

            TabButton(image: "Budget", zoomed: isZoomed, currentTab: $currentTab)

            TabButton(image: "Settings", zoomed: isZoomed, currentTab: $currentTab)
        }
        .padding(.horizontal, 15)
        .padding(.bottom, bottomEdge - 10)
        .frame(maxWidth: .infinity)
        .background(Color.PrimaryBackground)
        .sheet(isPresented: $addTransaction, onDismiss: {
            if confetti {
                if count != transactions.count {
                    counter += 1
                }
            }

            if firstLaunch {
                firstLaunch = false
            }

        }, content: {
            TransactionView(toEdit: nil)
        })
        .onChange(of: launchAdd) { _, _ in
            addTransaction = true
        }
        .onChange(of: addTransaction) { _, _ in
            if addTransaction {
                count = transactions.count
            }
        }
        .onChange(of: transactions.count) { _, _ in
            if !transactions.isEmpty {
                self.animate = false
            } else {
                self.animate = true
            }
        }
        .onOpenURL { url in
            guard
                url.host == "newExpense"

            else {
                return
            }

            addTransaction = true
        }
    }
}
