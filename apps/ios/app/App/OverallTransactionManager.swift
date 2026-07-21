//
//  OverallTransactionManager.swift
//  xpenz
//
//  Created by Rafael Soh on 20/5/22.
//

import Foundation
import SwiftUI

@MainActor
@Observable
class OverallTransactionManager {
    var toEdit: Transaction?
    var toDelete: Transaction?
    var showToast: Bool = false
    var showPopup: Bool = false
    var future: Bool = false
}
