//
//  HapticTapper.swift
//  Outlayr
//
//  Shared keypad haptics: one engine, created and started once, stopped when
//  the owning view disappears. Haptics are best-effort, so every failure path
//  is deliberately silent.
//

import CoreHaptics

final class HapticTapper {
    private var engine: CHHapticEngine?

    func prepare() {
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics, engine == nil else { return }
        engine = try? CHHapticEngine()
        try? engine?.start()
    }

    func tap() {
        guard let engine else { return }

        let event = CHHapticEvent(eventType: .hapticTransient, parameters: [], relativeTime: CHHapticTimeImmediate)
        guard let pattern = try? CHHapticPattern(events: [event], parameters: []),
              let player = try? engine.makePlayer(with: pattern) else { return }
        try? player.start(atTime: CHHapticTimeImmediate)
    }

    func stop() {
        engine?.stop()
        engine = nil
    }
}
