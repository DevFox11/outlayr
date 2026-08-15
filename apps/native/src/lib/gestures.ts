import { Gesture } from "react-native-gesture-handler";

/**
 * Lowercase aliases for the gesture builders.
 *
 * React Compiler reads any capitalized call as a component invocation, so
 * `Gesture.Pan()` trips its `CapitalizedCalls` rule and the enclosing component
 * goes unoptimized. Gesture handler has no lowercase entry point and oxlint's
 * port of the rule exposes no allowlist, so the rename lives here once instead
 * of as a suppression at each call site.
 *
 * These are the factories themselves, not wrappers — `Gesture.Pan` and
 * `Gesture.Tap` are plain arrows that close over nothing.
 */
export const panGesture = Gesture.Pan;
export const tapGesture = Gesture.Tap;
