import { useNavigation } from "expo-router";
import { type ReactNode, useEffect } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import Animated, {
	type SharedValue,
	useAnimatedReaction,
	useAnimatedStyle,
	useDerivedValue,
	useSharedValue,
} from "react-native-reanimated";
import { useIdentityFlyUp } from "@/contexts/identity-draft-context";
import { floatTargetY } from "@/domain/identity-flyup-geometry";
import {
	FLOAT_SCALE,
	FLOAT_TILE,
	HERO_RING,
	type HeroVariant,
	IdentityHero,
} from "./identity-hero";

export { FLOAT_SCALE, floatTargetY, HERO_RING };

/** Half the floated tile — what the clamp keeps below the top of the screen. */
const HERO_HALF = FLOAT_TILE / 2;
/**
 * Sheet height assumed on the very first open, before the sheet has ever laid out
 * and reported one. Mirrors `sheetAllowedDetents: [0.5, 1]` in `app/_layout.tsx`.
 */
const FIRST_OPEN_DETENT_FRACTION = 0.5;

/**
 * The screen-space Y delta from the hero's resting centre to its floated centre.
 *
 * Derived rather than computed in render because both inputs land late and out of
 * order — the container measures on layout, the sheet only once it exists — and a
 * plain number would rebuild the fly-up's animated style mid-flight, jumping the
 * tile.
 */
export function useFloatOffset({
	containerHeight,
	restCenterY,
}: {
	containerHeight: SharedValue<number>;
	restCenterY: SharedValue<number>;
}): SharedValue<number> {
	const { sheetHeight } = useIdentityFlyUp();
	// The screen is the floor under the form's own measurement: `containerHeight`
	// comes from a single `onLayout`, so anything that resets the shared value
	// without changing the layout leaves it at 0, and a 0 zeroes the travel and
	// kills the whole animation.
	const { height: windowHeight } = useWindowDimensions();
	return useDerivedValue(() => {
		// NaN, never <= 0, is the "not measured yet" sentinel: a scrolled hero has a
		// legitimately NEGATIVE form-local centre — it sits above the scroll view's
		// top edge, under the nav bar.
		if (Number.isNaN(restCenterY.value)) {
			return 0;
		}
		const container =
			containerHeight.value > 0 ? containerHeight.value : windowHeight;
		const sheet =
			sheetHeight.value > 0
				? sheetHeight.value
				: container * FIRST_OPEN_DETENT_FRACTION;
		return (
			floatTargetY({
				containerHeight: container,
				sheetHeight: sheet,
				heroHalf: HERO_HALF,
			}) - restCenterY.value
		);
	});
}

interface IdentityFlyUpLayerProps {
	/**
	 * Where the hero's ring rests right now, in form-local points, so the twin starts
	 * exactly on the real hero instead of jumping. A shared value because it is live:
	 * both screens re-publish it as the form scrolls, and it is read on the UI thread
	 * so tracking it costs no renders. The layer latches it for the flight.
	 */
	restTop: SharedValue<number>;
	/** Height of the screen the sheet is centred against. */
	containerHeight: SharedValue<number>;
	emoji: string | null;
	icon: string | null;
	photoUri: string | null;
	/** Custom color override; falls back to income green / foreground. */
	color: string | null;
	income: boolean;
	variant?: HeroVariant;
	/** Called after the return spring has already been started. */
	onDismiss: () => void;
}

/**
 * The two overlays a screen hosting the identity hero stacks over itself while the
 * picker is open: the tap-to-dismiss scrim, and the floating twin that flies up
 * and grows over the sheet.
 */
export function IdentityFlyUpLayer({
	restTop,
	containerHeight,
	emoji,
	icon,
	photoUri,
	color,
	income,
	variant = "transaction",
	onDismiss,
}: IdentityFlyUpLayerProps) {
	const { pickerOpen, setPickerOpen, floatProgress } = useIdentityFlyUp();

	// The launch point, held still for the duration of the flight: both screens
	// publish `restTop` live, so a reading landing mid-flight would move the launch
	// point out from under an animation that has already started and jerk the tile.
	// Reading `floatProgress` rather than `pickerOpen` keeps the latch on the UI
	// thread and ties it to the flight, which outlives the React state flip in both
	// directions.
	const restLaunchTop = useSharedValue(Number.NaN);
	useAnimatedReaction(
		() => (floatProgress.value === 0 ? restTop.value : null),
		(resting) => {
			if (resting !== null) {
				restLaunchTop.value = resting;
			}
		},
		[],
	);
	// The reaction only fires once the prepared value CHANGES, so the very first
	// reading has to be taken here or the latch would sit at its sentinel until the
	// user happened to scroll.
	useEffect(() => {
		if (Number.isNaN(restLaunchTop.value)) {
			restLaunchTop.value = restTop.value;
		}
	}, [restLaunchTop, restTop]);

	const restCenterY = useDerivedValue(
		() => restLaunchTop.value + HERO_RING / 2,
	);
	const floatOffsetY = useFloatOffset({ containerHeight, restCenterY });

	// A screen showing its own hero is, by definition, not showing a picker.
	// Asserted on mount because `pickerOpen` lives in the app-level provider and
	// outlives every screen: any path that leaves it true without the picker route
	// unmounting strands the scrim below on the next screen, where it is invisible
	// but still `pointerEvents: "auto"` and silently swallows every tap.
	useEffect(() => {
		setPickerOpen(false);
	}, [setPickerOpen]);

	// `translateY`, not `top`: this tracks the hero every scroll frame, and animating
	// a layout property runs a layout pass for the overlay each time. The hero's own
	// fly-up transform lives on a descendant view inside `IdentityHero`, so the two
	// stack instead of colliding.
	const twinStyle = useAnimatedStyle(() => ({
		transform: [{ translateY: restLaunchTop.value }],
	}));

	return (
		<>
			{/* Transparent: the blur is SwiftUI's own `.blur(radius:)` inside each
			    screen's `Host`, so what is left here is tap-outside-to-dismiss and
			    keeping the form beneath from being hit. */}
			{pickerOpen ? (
				<Pressable
					// `Pressable` defaults `accessible` to true, and a childless one
					// spanning the screen becomes a full-screen element with nothing to
					// announce, parked over the form. There is nothing here to reach by
					// touch exploration anyway: the sheet's own close affordance is how a
					// screen reader dismisses the picker.
					accessible={false}
					className="absolute inset-0"
					onPress={() => {
						setPickerOpen(false);
						onDismiss();
					}}
				/>
			) : null}

			<Animated.View
				pointerEvents="none"
				style={[
					{
						position: "absolute",
						top: 0,
						left: 0,
						right: 0,
						alignItems: "center",
					},
					twinStyle,
				]}
			>
				<IdentityHero
					color={color}
					emoji={emoji}
					floatOffsetY={floatOffsetY}
					floatProgress={floatProgress}
					icon={icon}
					income={income}
					isFloat
					photoUri={photoUri}
					variant={variant}
				/>
			</Animated.View>
		</>
	);
}

type DismissalEvent = { data?: { closing?: boolean } };
type DismissalNavigation = {
	addListener: (
		type: string,
		listener: (event: DismissalEvent) => void,
	) => () => void;
};

const NOOP = () => {
	// An unsupported listener name leaves nothing to unsubscribe from.
};

function listen(
	navigation: DismissalNavigation,
	type: string,
	listener: (event: DismissalEvent) => void,
): () => void {
	try {
		return navigation.addListener(type, listener) ?? NOOP;
	} catch {
		return NOOP;
	}
}

/**
 * The sheet's height is republished on every layout: react-native-screens pushes
 * the sheet view's fresh bounds into the shadow tree from `viewDidLayoutSubviews`,
 * which fires during a detent drag too.
 *
 * Two preconditions, because breaking either makes the height silently stop
 * arriving and the fly-up mis-centre rather than fail:
 *   - the route's `sheetAllowedDetents` is fractional, not `fitToContents`;
 *   - react-native-screens' `synchronousScreenUpdatesEnabled` is on (its default
 *     at 4.26.2).
 * The measured view must also stay a plain `View` — `RNSScreenContentWrapper.mm`
 * resizes a descendant ScrollView natively, bypassing the shadow tree, so hanging
 * this off the picker's own ScrollView or `Host` would report nothing.
 *
 * The unmount cleanup alone runs after the dismissal animation finishes, leaving
 * the enlarged hero frozen mid-screen. `transitionStart`/`beforeRemove` fire at
 * the front of it instead, but expo-router runs a forked native-stack and neither
 * name is contractual, so an unsupported one must neither throw nor strand the
 * screen; `setPickerOpen` is idempotent and the unmount cleanup is the backstop.
 * `transitionStart` is read in BOTH directions: a drag the user cancels starts the
 * transition and puts the sheet back, which would otherwise park the tile on the
 * form under a sheet that never left.
 */
export function IdentityFlyUpSheetHost({ children }: { children: ReactNode }) {
	const navigation = useNavigation<DismissalNavigation>();
	const { setPickerOpen, setSheetHeight } = useIdentityFlyUp();

	useEffect(() => {
		setPickerOpen(true);
		const unsubscribes = [
			listen(navigation, "transitionStart", (event) => {
				const closing = event.data?.closing;
				if (typeof closing === "boolean") {
					setPickerOpen(!closing);
				}
			}),
			listen(navigation, "beforeRemove", () => setPickerOpen(false)),
		];
		return () => {
			for (const unsubscribe of unsubscribes) {
				unsubscribe();
			}
			setPickerOpen(false);
		};
	}, [navigation, setPickerOpen]);

	return (
		<View
			onLayout={(event) => setSheetHeight(event.nativeEvent.layout.height)}
			style={{ flex: 1 }}
		>
			{children}
		</View>
	);
}
