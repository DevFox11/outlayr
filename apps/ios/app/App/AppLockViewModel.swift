//
//  AppLockViewModel.swift
//  Bonsai
//
//  Created by Rafael Soh on 7/7/22.
//

import Foundation
import LocalAuthentication
import SwiftUI
// All App Lock related methods will be handled here

@MainActor
@Observable
class AppLockViewModel {
    // Whether the app lock is enabled in user defaults
    var isAppLockEnabled: Bool = false
    // Whether the app is currently unlocked
    var isAppUnLocked: Bool = false

    var enrollmentError: Bool = false

    init() {
        getAppLockState()
    }

    // To enable the AppLock in UserDefaults
    func enableAppLock() {
        UserDefaults.standard.set(true, forKey: DefaultsKey.appLockEnabled)
        isAppLockEnabled = true
    }

    // To disable the AppLock in UserDefaults
    func disableAppLock() {
        UserDefaults.standard.set(false, forKey: DefaultsKey.appLockEnabled)
        isAppLockEnabled = false
    }

    // To Publish the AppLock state
    func getAppLockState() {
        isAppLockEnabled = UserDefaults.standard.bool(forKey: DefaultsKey.appLockEnabled)
    }

    // Checking if the device is having BioMetric hardware and enrolled
    func checkIfBioMetricAvailable() -> Bool {
        var error: NSError?
        let laContext = LAContext()

        let isBiometricAvailable = laContext.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)

        if let error = error {
            print(error.localizedDescription)
        }

        if isBiometricAvailable {
            enrollmentError = false
        } else {
            enrollmentError = true
        }

        return isBiometricAvailable
    }

    // This method is used to change the AppLock state.
    // If the user is going to enable the AppLock then 'appLockState' should be 'true' and vice versa
    func appLockStateChange(appLockState: Bool) async {
        let laContext = LAContext()
        guard checkIfBioMetricAvailable() else {
            if let settingsURL = URL(string: UIApplication.openSettingsURLString) {
                _ = await UIApplication.shared.open(settingsURL)
            }
            return
        }

        let reason = appLockState
            ? "Provice Touch ID/Face ID to enable App Lock"
            : "Provice Touch ID/Face ID to disable App Lock"

        do {
            let didSucceed = try await laContext.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason)
            if didSucceed {
                if appLockState {
                    enableAppLock()
                } else {
                    disableAppLock()
                }
                isAppUnLocked = true
            }
        } catch {
            print(error.localizedDescription)
        }
    }

    // This method is called on every launch of the app if the user has enabled AppLock
    func appLockValidation() async {
        let laContext = LAContext()
        guard checkIfBioMetricAvailable() else {
            if let settingsURL = URL(string: UIApplication.openSettingsURLString) {
                _ = await UIApplication.shared.open(settingsURL)
            }
            return
        }

        do {
            let didSucceed = try await laContext.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "Enable App Lock")
            if didSucceed {
                isAppUnLocked = true
            }
        } catch {
            print(error.localizedDescription)
        }
    }
}
