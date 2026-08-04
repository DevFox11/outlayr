import { ReduceMotion, type WithSpringConfig } from "react-native-reanimated";

/**
 * Every strip animation funnels through `applySpring` with this config, so
 * `reduceMotion: ReduceMotion.System` alone covers opacity, width, and
 * translateX — the reference has no reduced-motion handling anywhere.
 */
export const SPRING_CONFIG: WithSpringConfig = {
	damping: 20,
	mass: 0.55,
	stiffness: 250,
	reduceMotion: ReduceMotion.System,
};
