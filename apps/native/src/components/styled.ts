import { Image as ExpoImage } from "expo-image";
import { LinearGradient as ExpoLinearGradient } from "expo-linear-gradient";
import { withUniwind } from "uniwind";

/**
 * The third-party components this app styles. `withUniwind` may only ever run
 * once per component, so every `className`-aware wrapper lives here — anything
 * from `react-native` or `react-native-reanimated` already takes `className`
 * and must never be wrapped.
 *
 * `GlassView` is deliberately absent. Wrapping it renders NO glass at all —
 * verified by A/B on the simulator: the amount pad's key tiles disappear with
 * the wrapper and come back with the raw import plus
 * `style={StyleSheet.absoluteFill}`. Import it straight from
 * `expo-glass-effect`.
 */
export const Image = withUniwind(ExpoImage);
export const LinearGradient = withUniwind(ExpoLinearGradient);
