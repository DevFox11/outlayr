import type { ReactNode } from "react";
import Animated, {
	LayoutAnimationConfig,
	SlideInLeft,
	SlideInRight,
	SlideOutLeft,
	SlideOutRight,
	useReducedMotion,
} from "react-native-reanimated";

const DURATION = 220;

export interface StepTransitionProps {
	step: string;
	direction: 1 | -1;
	children: ReactNode;
}

/**
 * The one file design §4.1 lets a device proof (U1) replace wholesale: swap
 * the body for a transform-only two-slot container if `SlideIn*`/`SlideOut*`
 * don't play cleanly inside a formSheet. Nothing outside this file changes.
 */
export function StepTransition({
	step,
	direction,
	children,
}: StepTransitionProps) {
	const reduced = useReducedMotion();
	const entering = direction === 1 ? SlideInRight : SlideInLeft;
	const exiting = direction === 1 ? SlideOutLeft : SlideOutRight;

	return (
		<LayoutAnimationConfig skipEntering>
			<Animated.View
				className="flex-1"
				entering={reduced ? undefined : entering.duration(DURATION)}
				exiting={reduced ? undefined : exiting.duration(DURATION)}
				key={step}
				testID="wizard-step-transition"
			>
				{children}
			</Animated.View>
		</LayoutAnimationConfig>
	);
}
