import SwiftUI

private struct NumberFlowTransitionKey: EnvironmentKey {
    static let defaultValue = NumberFlowTransition.default
}

private struct NumberFlowTrendKey: EnvironmentKey {
    static let defaultValue = NumberFlowTrend.auto
}

private struct NumberFlowAnimatedKey: EnvironmentKey {
    static let defaultValue = true
}

private struct NumberFlowRespectsMotionPreferenceKey: EnvironmentKey {
    static let defaultValue = true
}

public extension EnvironmentValues {
    var numberFlowTransition: NumberFlowTransition {
        get { self[NumberFlowTransitionKey.self] }
        set { self[NumberFlowTransitionKey.self] = newValue }
    }

    var numberFlowTrend: NumberFlowTrend {
        get { self[NumberFlowTrendKey.self] }
        set { self[NumberFlowTrendKey.self] = newValue }
    }

    var numberFlowAnimated: Bool {
        get { self[NumberFlowAnimatedKey.self] }
        set { self[NumberFlowAnimatedKey.self] = newValue }
    }

    var numberFlowRespectsMotionPreference: Bool {
        get { self[NumberFlowRespectsMotionPreferenceKey.self] }
        set { self[NumberFlowRespectsMotionPreferenceKey.self] = newValue }
    }
}

public extension View {
    /// Overrides the transform/spin/opacity timings for every `NumberFlow` below.
    func numberFlowTransition(_ transition: NumberFlowTransition) -> some View {
        environment(\.numberFlowTransition, transition)
    }

    /// Overrides the roll direction policy for every `NumberFlow` below.
    func numberFlowTrend(_ trend: NumberFlowTrend) -> some View {
        environment(\.numberFlowTrend, trend)
    }

    /// Master animation switch: `false` makes every `NumberFlow` below snap to new
    /// values instantly.
    func numberFlowAnimated(_ animated: Bool) -> some View {
        environment(\.numberFlowAnimated, animated)
    }

    /// When `false`, `NumberFlow` keeps rolling even under system Reduce Motion.
    func numberFlowRespectsMotionPreference(_ respects: Bool) -> some View {
        environment(\.numberFlowRespectsMotionPreference, respects)
    }
}
