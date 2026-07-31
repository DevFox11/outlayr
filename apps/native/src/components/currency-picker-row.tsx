import {
	type MenuAction,
	MenuView,
	type NativeActionEvent,
} from "@expo/ui/community/menu";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react-native";
import { StarIcon as StarSolidIcon } from "@hugeicons-pro/core-solid-rounded";
import { StarIcon, Tick02Icon } from "@hugeicons-pro/core-stroke-rounded";
import { CURRENCY_META } from "@outlayr/money";
import { useRef } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import ReanimatedSwipeable, {
	type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
	Easing,
	LinearTransition,
	ReduceMotion,
	runOnJS,
	type SharedValue,
	useAnimatedReaction,
	useAnimatedStyle,
	useSharedValue,
} from "react-native-reanimated";
import type { CurrencyCode } from "@/domain/currency-picker-rows";
import { FAVOURITE_CURRENCY_LIMIT } from "@/domain/favourite-currencies";
import { useTranslation } from "@/i18n";
import { useHaptics } from "@/lib/use-haptics";
import { useColors } from "@/theme/use-colors";
import { MonoLabel } from "./mono-label";
import { Text } from "./text";
import { cn } from "./tw";

/**
 * Only `layout` is animated, never `entering`/`exiting`: the list is virtualised
 * over 165 currencies, so rows mount and unmount constantly while scrolling, and
 * an enter/exit animation would fire on all of them.
 */
export const ROW_TRAVEL = LinearTransition.duration(260)
	.easing(Easing.bezier(0.645, 0.045, 0.355, 1).factory())
	.reduceMotion(ReduceMotion.System);

export function CurrencySectionHeader({
	section,
}: {
	section: "favourites" | "all";
}) {
	const t = useTranslation();
	return (
		<Animated.View layout={ROW_TRAVEL}>
			<MonoLabel className="pt-4 pb-1">
				{t(
					section === "favourites"
						? "settings.currency.favourites"
						: "settings.currency.all",
				)}
			</MonoLabel>
		</Animated.View>
	);
}

export function CurrencyHint() {
	const t = useTranslation();
	return (
		<Animated.View layout={ROW_TRAVEL}>
			<Text className="pb-3 text-footnote text-muted">
				{t("settings.currency.favouritesHint")}
			</Text>
		</Animated.View>
	);
}

/** The lane at rest, before a drag stretches it. */
const LANE_WIDTH = 96;

/**
 * How far right-to-left a drag has to travel before the action fires on its own,
 * as a fraction of the screen. SwiftUI's `allowsFullSwipe` has no equivalent on
 * `ReanimatedSwipeable`, so it is rebuilt from the `translation` shared value the
 * action renderer is handed.
 */
const FULL_SWIPE_FRACTION = 0.45;

function SwipeAction({
	accessibilityHint,
	accessibilityLabel,
	fillClassName,
	icon,
	iconColor,
	label,
	labelClassName,
	onFullSwipe,
	onPress,
	translation,
}: {
	accessibilityHint?: string;
	accessibilityLabel: string;
	fillClassName: string;
	icon: IconSvgElement;
	iconColor: string;
	label: string;
	labelClassName: string;
	onFullSwipe: () => void;
	onPress: () => void;
	translation: SharedValue<number>;
}) {
	const { width } = useWindowDimensions();
	const threshold = width * FULL_SWIPE_FRACTION;
	// Latched so the reaction fires once per drag rather than on every frame past
	// the threshold, and rearms only when the finger comes back inside it.
	const fired = useSharedValue(false);

	useAnimatedReaction(
		() => translation.value,
		(travel) => {
			if (travel > -threshold) {
				fired.value = false;
				return;
			}
			if (!fired.value) {
				fired.value = true;
				runOnJS(onFullSwipe)();
			}
		},
	);

	// The lane follows the finger past its resting width, which is what makes a
	// full swipe legible as one: the pill grows to own the row before it fires.
	const style = useAnimatedStyle(() => ({
		width: Math.max(LANE_WIDTH, -translation.value - 12),
	}));

	return (
		<Animated.View className="my-1 ml-3" style={style}>
			<Pressable
				accessibilityHint={accessibilityHint}
				accessibilityLabel={accessibilityLabel}
				accessibilityRole="button"
				className={cn(
					"flex-1 items-center justify-center gap-1 rounded-xl",
					fillClassName,
				)}
				onPress={onPress}
			>
				<HugeiconsIcon
					color={iconColor}
					icon={icon}
					size={18}
					strokeWidth={2}
				/>
				<Text
					className={cn("font-sans-semibold text-footnote", labelClassName)}
				>
					{label}
				</Text>
			</Pressable>
		</Animated.View>
	);
}

interface CurrencyRowProps {
	code: CurrencyCode;
	favourite: boolean;
	selected: boolean;
	full: boolean;
	onPress: () => void;
	/** `null` while no database is open, so favouriting is absent rather than dead. */
	onToggleFavourite: (() => void) | null;
}

export function CurrencyRow({
	code,
	favourite,
	selected,
	full,
	onPress,
	onToggleFavourite,
}: CurrencyRowProps) {
	const colors = useColors();
	const haptics = useHaptics();
	const t = useTranslation();
	const swipeRef = useRef<SwipeableMethods>(null);
	// A full swipe fires while the finger is still down, so the `close()` inside
	// `commit` is undone when the gesture settles the lane open. The latch lets
	// `onSwipeableOpen` close it once the gesture has actually finished.
	const firedFullSwipe = useRef(false);
	const meta = CURRENCY_META[code];

	const refuses = !favourite && full;
	const fullLabel = t("settings.currency.favouritesFull", {
		limit: FAVOURITE_CURRENCY_LIMIT,
	});
	// A refusal stays neutral rather than taking a fill: a coloured pill reads as
	// an invitation, and this one does nothing.
	const laneFill = refuses
		? "bg-surface-secondary"
		: favourite
			? "bg-danger-fill"
			: "bg-gold-fill";

	/**
	 * Only the refusal this row can already see is answered here. `full` comes
	 * from a live query, so two rows pressed a tick apart at seven favourites can
	 * both render as not-full; the second learns otherwise only from the list the
	 * write returns, which is why the caller owns that outcome's haptic.
	 */
	const commit = () => {
		swipeRef.current?.close();
		if (refuses) {
			haptics("warning");
			return;
		}
		onToggleFavourite?.();
	};

	const renderRightActions = (
		_progress: SharedValue<number>,
		translation: SharedValue<number>,
	) => (
		<SwipeAction
			accessibilityHint={
				refuses ? t("settings.currency.favouritesFullBody") : undefined
			}
			accessibilityLabel={
				refuses
					? fullLabel
					: t(
							favourite
								? "settings.currency.unfavourite"
								: "settings.currency.favourite",
							{ code },
						)
			}
			fillClassName={laneFill}
			icon={favourite || refuses ? StarIcon : StarSolidIcon}
			iconColor={refuses ? colors.muted : "#ffffff"}
			label={
				refuses
					? t("settings.currency.favouritesFullShort", {
							limit: FAVOURITE_CURRENCY_LIMIT,
						})
					: t(
							favourite
								? "settings.currency.unfavouriteAction"
								: "settings.currency.favouriteAction",
						)
			}
			labelClassName={refuses ? "text-muted" : "text-white"}
			onFullSwipe={() => {
				firedFullSwipe.current = true;
				commit();
			}}
			onPress={commit}
			translation={translation}
		/>
	);

	// `image` takes SF Symbols only — UIKit draws these glyphs itself.
	const actions: MenuAction[] = [];
	if (onToggleFavourite !== null) {
		actions.push({
			id: "favourite",
			title: refuses
				? fullLabel
				: t(
						favourite
							? "settings.currency.unfavourite"
							: "settings.currency.favourite",
						{ code },
					),
			image: favourite ? "star.slash" : "star",
			attributes: refuses ? { disabled: true } : undefined,
		});
	}
	actions.push({
		id: "use",
		title: t("settings.currency.use", { code }),
		state: selected ? "on" : "off",
	});

	const onPressAction = ({ nativeEvent }: NativeActionEvent) => {
		if (nativeEvent.event === "use") {
			onPress();
			return;
		}
		commit();
	};

	return (
		// No `layout` here, unlike the headers. A row leaving the cluster lands
		// wherever it falls in a 165-row alphabet, which is outside the virtualised
		// window, so it unmounts mid-animation and never vacates its old slot —
		// leaving a blank gap in the cluster.
		<View>
			<ReanimatedSwipeable
				friction={1}
				// Overshoot is what makes the full swipe reachable at all: clamped at the
				// lane's width, `translation` never travels far enough to cross the
				// threshold `SwipeAction` watches.
				overshootFriction={1}
				onSwipeableOpen={() => {
					if (firedFullSwipe.current) {
						firedFullSwipe.current = false;
						swipeRef.current?.close();
					}
				}}
				ref={swipeRef}
				renderRightActions={
					onToggleFavourite === null ? undefined : renderRightActions
				}
				rightThreshold={40}
			>
				{/* Not `@expo/ui/swift-ui`'s ContextMenu: that needs a SwiftUI `Host` per
				    row, and `Host` cannot be told to fill its parent's width — `frame`
				    takes numbers, not `.infinity` — so every row sat as its own inset
				    card. This wraps React Native children directly. */}
				<MenuView
					actions={actions}
					onPressAction={onPressAction}
					shouldOpenOnLongPress
					title={
						refuses ? t("settings.currency.favouritesFullBody") : undefined
					}
				>
					<Pressable
						accessibilityRole="button"
						accessibilityState={{ selected }}
						// `bg-background` is required, not cosmetic: UIKit snapshots this view
						// for the context-menu platter, and a transparent trigger composites
						// its preview over the row beneath. It also stops the swipe lane
						// showing through. Callers must stand the list on the same ground.
						className="flex-row items-center gap-3 border-border border-b bg-background py-3 active:opacity-60"
						onPress={onPress}
					>
						<View className="w-9 items-center">
							<Text
								className="text-body text-muted"
								style={{ fontVariant: ["tabular-nums"] }}
							>
								{meta.symbol}
							</Text>
						</View>
						<View className="flex-1">
							<Text className="text-body text-foreground">{code}</Text>
							<Text className="text-footnote text-muted" numberOfLines={1}>
								{meta.name}
							</Text>
						</View>
						{/* Both columns keep their width whether or not they draw, so the
						    marks stay in one line down the list. */}
						<View className="w-4 items-center">
							{favourite ? (
								<HugeiconsIcon
									color={colors.gold}
									icon={StarSolidIcon}
									size={15}
								/>
							) : null}
						</View>
						<View className="w-5 items-center">
							{selected ? (
								<HugeiconsIcon
									color={colors.tint}
									icon={Tick02Icon}
									size={20}
									strokeWidth={2.4}
								/>
							) : null}
						</View>
					</Pressable>
				</MenuView>
			</ReanimatedSwipeable>
		</View>
	);
}
