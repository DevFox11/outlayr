import { useEffect } from "react";
import { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

/** The app's shake, leg for leg — see `screens/budgets/components/budget-form.tsx`. */
const LEG = { duration: 45 } as const;

/**
 * Answers a rejected save on the slot that caused it. Shared by the filled and
 * unfilled parts because either can be the one holding the save back: a
 * category suggested by enrichment is a value on screen and still fails if it
 * cannot be created.
 */
export function useSentenceShake(shake: boolean | undefined) {
    const reduced = useReducedMotion();
    const offset = useSharedValue(0);

    useEffect(() => {
        if (!shake || reduced) {
            return;
        }
        offset.set(withSequence(withTiming(-8, LEG), withTiming(8, LEG), withTiming(-6, LEG), withTiming(0, LEG)));
    }, [offset, reduced, shake]);

    return useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));
}
