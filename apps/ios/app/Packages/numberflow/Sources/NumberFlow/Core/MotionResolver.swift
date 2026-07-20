/// The effective animation mode after gating on the master switch, the system
/// Reduce Motion preference, and scene visibility.
public enum NumberFlowMotion: Equatable, Sendable {
    /// Full rolling animation.
    case animated
    /// Reduce Motion is on: values crossfade instead of rolling.
    case crossfade
    /// Animation is off (explicitly, or the scene is not visible): values snap.
    case disabled
}

public enum MotionResolver {
    public static func resolve(
        animated: Bool = true,
        respectMotionPreference: Bool = true,
        reduceMotion: Bool,
        isActive: Bool = true
    ) -> NumberFlowMotion {
        guard animated, isActive else { return .disabled }
        if respectMotionPreference, reduceMotion { return .crossfade }
        return .animated
    }
}
