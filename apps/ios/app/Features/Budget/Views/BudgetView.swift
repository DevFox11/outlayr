//
//  BudgetView.swift
//  xpenz
//
//  Created by Rafael Soh on 20/5/22.
//

import CoreData
import Foundation
import SwiftUI

struct BudgetView: View {
    @FetchRequest(sortDescriptors: []) private var categories: FetchedResults<Category>
    @FetchRequest(sortDescriptors: []) private var budgets: FetchedResults<Budget>
    @FetchRequest(sortDescriptors: []) private var mainBudget: FetchedResults<MainBudget>

    var body: some View {
        if categories.isEmpty && budgets.isEmpty && mainBudget.isEmpty {
            VStack(spacing: 5) {
                Image("category-3")
                    .resizable()
                    .frame(width: 75, height: 75)
                    .padding(.bottom, 20)

                Text("Budget Your Finances")
                    .font(.system(.title2, design: .rounded).weight(.medium))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Color.PrimaryText.opacity(0.8))

                Text("Link budgets to categories and set appropriate expenditure goals")
                    .font(.system(.body, design: .rounded).weight(.medium))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Color.SubtitleText)
            }
            .padding(.horizontal, 30)
            .frame(height: 250, alignment: .top)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .ignoresSafeArea(.all)
            .background(Color.PrimaryBackground)

        } else {
            ActualBudgetView()
        }
    }
}
