import { createContext } from "react";
import type { SharedValue } from "react-native-reanimated";
import type { StripGeometry } from "./geometry";

export interface StripContextValue {
	/**
	 * A SharedValue, not a plain object: `useAnimatedStyle`'s reactivity is
	 * driven by SharedValue mutation, not by React re-renders, so a
	 * closure-captured plain `StripGeometry` would freeze at its first-render
	 * value (`containerWidth: 0`) forever once `onLayout` fires.
	 */
	geometryShared: SharedValue<StripGeometry>;
	/** React-state mirror of `expandedIndexShared`, gating non-animatable a11y/pointerEvents props. */
	expandedIndex: number;
	expandedIndexShared: SharedValue<number>;
	setExpanded: (index1: number) => void;
}

export const StripContext = createContext<StripContextValue | null>(null);

export const StripPositionContext = createContext<{ index1: number } | null>(
	null,
);
