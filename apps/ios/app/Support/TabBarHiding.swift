//
//  TabBarHiding.swift
//  Outlayr
//
//  Created by Rafael Soh on 18/9/22.
//

import Foundation

@MainActor
@Observable
class TabBarManager {
    var hideTab = false
    var inNavigationLink = false

    func navigationHideTab() {
        inNavigationLink = true
        hideTab = true
    }

    func navigationShowTab() {
        inNavigationLink = false
        hideTab = false
    }

    func scrollHideTab() {
        if !inNavigationLink {
            hideTab = true
        }
    }

    func scrollShowTab() {
        if !inNavigationLink {
            hideTab = false
        }
    }
}
