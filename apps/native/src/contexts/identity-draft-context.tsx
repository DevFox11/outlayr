import { createContext, use, useCallback, useMemo, useRef, useState } from "react";
import { type SharedValue, useSharedValue, withSpring } from "react-native-reanimated";
import type { IdentitySelection } from "@/components/identity-picker-content";
import { useHaptics } from "@/lib/use-haptics";

/** Launch spring (response 0.4, dampingFraction 0.85) as stiffness/damping. */
export const LAUNCH_SPRING = { damping: 27, mass: 1, stiffness: 246 } as const;
/**
 * Not the launch played backwards: the return has to land inside the ~350ms UIKit
 * takes to dismiss the sheet, or the hero is still easing home after the sheet has
 * gone. ω ≈ 17.3 rad/s (response 0.36) with ζ ≈ 0.92 reaches Reanimated's rest
 * band at ~290ms.
 */
const RETURN_SPRING = { damping: 32, mass: 1, stiffness: 300 } as const;

interface IdentityDraftValue {
	draft: IdentitySelection;
	// Accepts an updater as well as a value: an async writer (a fetched logo)
	// has to re-read the draft at write time, because the seeding effect may
	// have replaced it while the request was out.
	setDraft: (next: IdentitySelection | ((previous: IdentitySelection) => IdentitySelection)) => void;
}

interface IdentityFlyUpValue {
	/**
	 * 0 → resting, 1 → floated.
	 *
	 * The form is not frozen behind the picker: react-native-screens ships
	 * `ENABLE_FREEZE = false`, this app never calls `enableFreeze()`, and no route
	 * sets `freezeOnBlur`.
	 */
	floatProgress: SharedValue<number>;
	pickerOpen: boolean;
	setPickerOpen: (open: boolean) => void;
	setSheetHeight: (height: number) => void;
	/**
	 * The picker sheet's measured height in points, 0 until it has ever laid out.
	 * The sheet uses FRACTIONAL detents, so its height varies by device and cannot
	 * be replaced with a constant.
	 */
	sheetHeight: SharedValue<number>;
}

const EMPTY_DRAFT: IdentitySelection = {
	color: null,
	emoji: null,
	icon: null,
	photoColor: null,
	photoUri: null,
};

const OUTSIDE_PROVIDER = "useIdentityDraft and useIdentityFlyUp must be used within IdentityDraftProvider";

const IdentityDraftContext = createContext<IdentityDraftValue | null>(null);
const IdentityFlyUpContext = createContext<IdentityFlyUpValue | null>(null);

/**
 * Two contexts under one provider: every tap inside the open picker replaces
 * `draft`, so merging them would drag every consumer — the whole transaction
 * form, SwiftUI `Host` tree included — through a re-render per tap.
 */
export function IdentityDraftProvider({ children }: { children: React.ReactNode }) {
	const haptics = useHaptics();
	const [draft, setDraft] = useState<IdentitySelection>(EMPTY_DRAFT);
	const [pickerOpen, setPickerOpenState] = useState(false);
	const floatProgress = useSharedValue(0);
	const sheetHeight = useSharedValue(0);

	// Idempotent: the opener starts the spring on the tap frame, the picker route
	// re-asserts it on mount, and on the way out every dismissal signal the route
	// can subscribe to races to be first. Without this guard a second call would
	// restart the spring from zero velocity mid-flight and visibly hitch.
	const openRef = useRef(false);
	const setPickerOpen = useCallback(
		(open: boolean) => {
			if (openRef.current === open) {
				return;
			}
			openRef.current = open;
			if (open) {
				// Nothing on the return: UIKit starts the dismissal transition before it
				// decides whether to put the sheet back, so an aborted detent drag would
				// fire a tap for a dismissal that never happened.
				haptics("light");
			}
			setPickerOpenState(open);
			floatProgress.value = withSpring(open ? 1 : 0, open ? LAUNCH_SPRING : RETURN_SPRING);
		},
		[floatProgress, haptics]
	);

	// A JS-side latch instead of reading `sheetHeight.value`: that is a cross-thread
	// read on every sheet layout, and two layouts landing before the UI thread syncs
	// would both still see the 0 sentinel and both hard-set.
	const sheetMeasured = useRef(false);
	const setSheetHeight = useCallback(
		(height: number) => {
			// The first measurement lands hard: springing off the 0 sentinel would drag
			// the hero's target through every height in between while it is still
			// flying up.
			if (sheetMeasured.current) {
				sheetHeight.value = withSpring(height, LAUNCH_SPRING);
				return;
			}
			sheetMeasured.current = true;
			sheetHeight.value = height;
		},
		[sheetHeight]
	);

	const draftValue = useMemo(() => ({ draft, setDraft }), [draft]);
	const flyUpValue = useMemo(
		() => ({
			floatProgress,
			pickerOpen,
			setPickerOpen,
			setSheetHeight,
			sheetHeight,
		}),
		[pickerOpen, setPickerOpen, floatProgress, sheetHeight, setSheetHeight]
	);

	return (
		<IdentityDraftContext.Provider value={draftValue}>
			<IdentityFlyUpContext.Provider value={flyUpValue}>{children}</IdentityFlyUpContext.Provider>
		</IdentityDraftContext.Provider>
	);
}

export function useIdentityDraft(): IdentityDraftValue {
	const value = use(IdentityDraftContext);
	if (value == null) {
		throw new Error(OUTSIDE_PROVIDER);
	}
	return value;
}

export function useIdentityFlyUp(): IdentityFlyUpValue {
	const value = use(IdentityFlyUpContext);
	if (value == null) {
		throw new Error(OUTSIDE_PROVIDER);
	}
	return value;
}
