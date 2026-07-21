//
//  HapticSetting.swift
//  Outlayr
//

import CoreHaptics

/// Values of the "haptics" AppStorage setting (Settings > Haptics picker).
enum HapticSetting: Int {
    case none = 0
    case subtle = 1
    case excessive = 2
}
