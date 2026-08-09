import { HugeiconsIcon } from "@hugeicons/react-native";
import { Cancel01Icon, PlusSignIcon } from "@hugeicons-pro/core-stroke-rounded";
import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { useEffect, useId, useRef } from "react";
import { Pressable, View } from "react-native";
import Animated, {
	type SharedValue,
	useAnimatedStyle,
	useSharedValue,
	withSequence,
	withSpring,
	withTiming,
} from "react-native-reanimated";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { LAUNCH_SPRING, useIdentityFlyUp } from "@/contexts/identity-draft-context";
import { type TranslationKey, useTranslation } from "@/i18n";
import { withAlpha } from "@/theme/shade";
import { useColors } from "@/theme/use-colors";
import { CategoryIconTile } from "./category-icon-tile";
import { SpectrumRing } from "./spectrum-ring";
import { Text } from "./text";

const TILE = 90;
export const HERO_RING = TILE + 12;
const BADGE = 26;
/** App-icon squircle radius (~22% of the 90pt tile) shared by every state. */
const RADIUS = 20;

/** The tile edge the picker animates the hero up to. */
export const FLOAT_TILE = 164;
export const FLOAT_SCALE = FLOAT_TILE / TILE;

/** Response 0.25, dampingFraction 0.7, converted to stiffness/damping. */
const PRESS_SPRING = { damping: 35, mass: 1, stiffness: 631 } as const;

/**
 * Float progress above which the floating twin owns the tile and the in-scroll
 * hero gives it up. One threshold read by both, so exactly one tile is ever drawn.
 * 0.01 is Reanimated's own `restDisplacementThreshold`: a spring inside that band
 * is considered home and snapped to its target, so swapping there never leaves the
 * twin drawing a frame the spring is about to discontinuously correct.
 */
const SWAP_EPS = 0.01;
const POP_SCALE = 1.06;
/** Short enough to finish well inside the pop's return leg. */
const POP_FADE_MS = 160;

/**
 * `transaction`: a photo glyph, the spinning spectrum ring, a radial ghost fill,
 * and a caption in both states. `category`: no photo (a category cannot have
 * one), no ring, a flat ghost fill, sparkles set wider, and an invitation that
 * exists only while the tile is empty.
 */
export type HeroVariant = "transaction" | "category";

/** Sparkle offsets from the tile CENTRE, per variant. */
const SPARKLES = {
	category: { large: [-62, -30], small: [60, 8] },
	transaction: { large: [-53, -33], small: [51, 8] },
} as const;

/**
 * Tile-to-caption gap. The category one is a gap only in appearance: that caption
 * is absolutely positioned, so it hangs below the hero without adding to its
 * height, and the form's `captionClearance` is what reserves the room for it.
 */
const CAPTION_GAP = { category: 8, transaction: 12 } as const;

const A11Y: Record<
	HeroVariant,
	{
		readonly tile: TranslationKey;
		readonly hint: TranslationKey;
		readonly reset: TranslationKey;
	}
> = {
	category: {
		hint: "transaction.identity.hero.iconHint",
		reset: "transaction.identity.hero.removeIcon",
		tile: "transaction.identity.hero.icon",
	},
	transaction: {
		hint: "transaction.identity.hero.logoHint",
		reset: "transaction.identity.hero.removeLogo",
		tile: "transaction.identity.hero.logo",
	},
};

const EMPTY_CAPTION: Record<HeroVariant, TranslationKey> = {
	category: "transaction.identity.hero.chooseIcon",
	transaction: "transaction.identity.hero.logo",
};

interface IdentityHeroProps {
	/** Custom color override; falls back to income green / foreground. */
	color: string | null;
	emoji: string | null;
	/**
	 * Screen-space Y delta from the resting center to the floated center. A shared
	 * value, not a number: it depends on measurements that land after the flight has
	 * started, and a prop change would rebuild this style mid-flight and jump the tile.
	 */
	floatOffsetY?: SharedValue<number>;
	/**
	 * 0 → resting in the form; 1 → floated + enlarged over the open picker. Drives
	 * the fly-up (scale + translate) and, past {@link SWAP_EPS}, which of the two
	 * heroes is the one being drawn.
	 */
	floatProgress?: SharedValue<number>;
	icon: string | null;
	income: boolean;
	/**
	 * When true, this is the floating twin: it renders above everything, applies the
	 * fly-up transform, drops the caption/reset, and ignores touches. It is drawn
	 * only once `floatProgress` clears {@link SWAP_EPS}; the in-scroll hero (false)
	 * is drawn on exactly the frames the twin is not.
	 */
	isFloat?: boolean;
	onPress?: () => void;
	onReset?: () => void;
	photoUri: string | null;
	variant?: HeroVariant;
}

/** A ~90pt app-icon squircle that opens the identity picker. */
export function IdentityHero({
	emoji,
	icon,
	photoUri,
	color,
	income,
	floatProgress,
	floatOffsetY,
	isFloat = false,
	variant = "transaction",
	onPress,
	onReset,
}: IdentityHeroProps) {
	const colors = useColors();
	const t = useTranslation();
	const { pickerOpen } = useIdentityFlyUp();
	const tint = color ?? (income ? colors.income : colors.foreground);
	const isEmpty = !(emoji || icon || photoUri);

	const pressScale = useSharedValue(1);
	const pressOpacity = useSharedValue(1);
	const popScale = useSharedValue(1);
	const contentOpacity = useSharedValue(1);
	const float = floatProgress;

	const wasEmpty = useRef(isEmpty);
	const identity = `${emoji}|${icon}|${photoUri}|${color}`;
	// `pickerOpen` gates the pop rather than a first-render latch: both forms seed the
	// draft from their stored row in a mount effect, and by content alone that seed is
	// indistinguishable from a pick. A pick can only land while the picker is up.
	//
	// `isEmpty` and `pickerOpen` are deliberately read as the state at the moment the
	// identity changed; listing them would re-fire the pop when the picker merely
	// opens or closes over an unchanged tile.
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the identity string alone, see above
	useEffect(() => {
		const becameEmpty = isEmpty && !wasEmpty.current;
		wasEmpty.current = isEmpty;
		if (becameEmpty) {
			// A reset springs without the overshoot a pick gets.
			contentOpacity.value = 0;
			contentOpacity.value = withSpring(1, LAUNCH_SPRING);
			return;
		}
		if (isEmpty || !pickerOpen) {
			return;
		}
		popScale.value = withSequence(withSpring(POP_SCALE, PRESS_SPRING), withSpring(1, PRESS_SPRING));
		contentOpacity.value = 0;
		contentOpacity.value = withTiming(1, { duration: POP_FADE_MS });
	}, [identity]);

	// A hard swap, not a crossfade: a single threshold read by both heroes means
	// there is never a frame with two tiles or none, and the twin starts on the
	// resting hero's own frame, so the seam has nothing to show.
	const rootStyle = useAnimatedStyle(() => {
		const floated = (float?.value ?? 0) > SWAP_EPS;
		return { opacity: (isFloat ? floated : !floated) ? 1 : 0 };
	});

	const tileStyle = useAnimatedStyle(() => {
		if (isFloat) {
			const p = float?.value ?? 0;
			const grown = 1 + p * (FLOAT_SCALE - 1);
			return {
				opacity: contentOpacity.value,
				transform: [{ translateY: p * (floatOffsetY?.value ?? 0) }, { scale: grown * popScale.value }],
			};
		}
		return {
			opacity: pressOpacity.value * contentOpacity.value,
			transform: [{ scale: pressScale.value * popScale.value }],
		};
	});

	const tile = (
		<View style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
			<HeroGlyph
				colors={colors}
				emoji={emoji}
				icon={icon}
				isEmpty={isEmpty}
				photoUri={photoUri}
				tint={tint}
				variant={variant}
			/>
		</View>
	);

	const plusBadge = (
		<View
			style={{
				alignItems: "center",
				backgroundColor: colors.foreground,
				borderRadius: BADGE / 2,
				bottom: -1,
				height: BADGE,
				justifyContent: "center",
				position: "absolute",
				right: -1,
				width: BADGE,
			}}
		>
			<HugeiconsIcon color={colors.background} icon={PlusSignIcon} size={14} strokeWidth={2.4} />
		</View>
	);

	return (
		<Animated.View
			pointerEvents={isFloat ? "none" : "auto"}
			style={[
				{
					alignItems: "center",
					gap: variant === "category" ? 0 : CAPTION_GAP.transaction,
				},
				rootStyle,
			]}
		>
			<Animated.View style={tileStyle}>
				{isFloat ? (
					<View style={{ height: HERO_RING, width: HERO_RING }}>
						{tile}
						{isEmpty ? plusBadge : null}
					</View>
				) : (
					<Pressable
						accessibilityHint={t(A11Y[variant].hint)}
						accessibilityLabel={t(A11Y[variant].tile)}
						accessibilityRole="button"
						onPress={onPress}
						onPressIn={() => {
							pressScale.value = withSpring(0.96, PRESS_SPRING);
							pressOpacity.value = withSpring(0.85, PRESS_SPRING);
						}}
						onPressOut={() => {
							pressScale.value = withSpring(1, PRESS_SPRING);
							pressOpacity.value = withSpring(1, PRESS_SPRING);
						}}
						style={{ height: HERO_RING, width: HERO_RING }}
					>
						{tile}
						{isEmpty ? (
							plusBadge
						) : (
							<Pressable
								accessibilityLabel={t(A11Y[variant].reset)}
								accessibilityRole="button"
								hitSlop={8}
								onPress={onReset}
								style={{
									alignItems: "center",
									backgroundColor: colors.danger,
									borderRadius: BADGE / 2,
									height: BADGE,
									justifyContent: "center",
									position: "absolute",
									right: 0,
									top: 0,
									width: BADGE,
								}}
							>
								<HugeiconsIcon color="#FFFFFF" icon={Cancel01Icon} size={13} strokeWidth={2.4} />
							</Pressable>
						)}
					</Pressable>
				)}
			</Animated.View>

			{/* A filled category hero has no caption at all; the transaction one
			    switches copy instead. */}
			{isFloat || (variant === "category" && !isEmpty) ? null : (
				<Text
					className="font-sans-medium text-footnote text-muted"
					style={
						variant === "category" && {
							alignSelf: "center",
							position: "absolute",
							top: HERO_RING + CAPTION_GAP.category,
						}
					}
				>
					{t(isEmpty ? EMPTY_CAPTION[variant] : "transaction.identity.hero.tapToChange")}
				</Text>
			)}
		</Animated.View>
	);
}

function HeroGlyph({
	isEmpty,
	photoUri,
	icon,
	emoji,
	tint,
	colors,
	variant,
}: {
	isEmpty: boolean;
	photoUri: string | null;
	icon: string | null;
	emoji: string | null;
	tint: string;
	colors: ReturnType<typeof useColors>;
	variant: HeroVariant;
}) {
	if (isEmpty) {
		return <EmptyTile colors={colors} variant={variant} />;
	}
	if (photoUri) {
		return <PhotoTile border={withAlpha(colors.foreground, 0.14)} uri={photoUri} />;
	}
	if (icon) {
		return <CategoryIconTile color={tint} icon={icon} size={TILE} />;
	}
	return <EmojiTile emoji={emoji ?? ""} tint={tint} />;
}

function PhotoTile({ uri, border }: { uri: string; border: string }) {
	return (
		<View style={{ height: TILE, width: TILE }}>
			<Image contentFit="cover" source={{ uri }} style={{ borderRadius: RADIUS, height: TILE, width: TILE }} />
			<View
				style={{
					borderColor: border,
					borderRadius: RADIUS,
					borderWidth: 1.5,
					height: TILE,
					position: "absolute",
					width: TILE,
				}}
			/>
		</View>
	);
}

function EmojiTile({ emoji, tint }: { emoji: string; tint: string }) {
	return (
		<View
			style={{
				alignItems: "center",
				backgroundColor: withAlpha(tint, 0.22),
				borderRadius: RADIUS,
				height: TILE,
				justifyContent: "center",
				width: TILE,
			}}
		>
			{/* Sized off `CategoryIconTile`'s large icon size, not off the tile. */}
			<Text className="text-[42px]">{emoji}</Text>
		</View>
	);
}

function EmptyTile({ colors, variant }: { colors: ReturnType<typeof useColors>; variant: HeroVariant }) {
	const fillId = useId();
	const isCategory = variant === "category";
	const [sparkleLarge, sparkleSmall] = [SPARKLES[variant].large, SPARKLES[variant].small];
	return (
		<View
			style={{
				alignItems: "center",
				height: HERO_RING,
				justifyContent: "center",
				width: HERO_RING,
			}}
		>
			{/* First, so the ring sits behind the dashed outline and the glyph. */}
			{isCategory ? null : <SpectrumRing radius={RADIUS + (HERO_RING - TILE) / 2} size={HERO_RING} />}

			<Svg height={TILE} style={{ position: "absolute" }} width={TILE}>
				<Defs>
					<RadialGradient cx={TILE * 0.35} cy={TILE * 0.28} gradientUnits="userSpaceOnUse" id={fillId} r={TILE * 0.7}>
						<Stop offset="0" stopColor={colors.muted} stopOpacity={0.1} />
						<Stop offset="1" stopColor={colors.muted} stopOpacity={0.04} />
					</RadialGradient>
				</Defs>
				<Rect
					fill={isCategory ? colors.muted : `url(#${fillId})`}
					fillOpacity={isCategory ? 0.05 : 1}
					height={TILE}
					rx={RADIUS}
					ry={RADIUS}
					width={TILE}
					x={0}
					y={0}
				/>
				<Rect
					fill="none"
					height={TILE - 1.8}
					rx={RADIUS - 0.9}
					ry={RADIUS - 0.9}
					stroke={withAlpha(colors.muted, 0.32)}
					strokeDasharray="5 5"
					strokeWidth={1.8}
					width={TILE - 1.8}
					x={0.9}
					y={0.9}
				/>
			</Svg>

			{/* A category is an icon or an emoji, never a photo. */}
			{isCategory ? null : (
				<SymbolView name="photo" size={30} tintColor={colors.muted} type="monochrome" weight="regular" />
			)}

			<SymbolView
				name="sparkle"
				size={12}
				style={{
					height: 12,
					left: HERO_RING / 2 + sparkleLarge[0] - 6,
					position: "absolute",
					top: HERO_RING / 2 + sparkleLarge[1] - 6,
					width: 12,
				}}
				tintColor={colors.muted}
				type="monochrome"
			/>
			<SymbolView
				name="sparkle"
				size={9}
				style={{
					height: 9,
					left: HERO_RING / 2 + sparkleSmall[0] - 4.5,
					position: "absolute",
					top: HERO_RING / 2 + sparkleSmall[1] - 4.5,
					width: 9,
				}}
				tintColor={colors.muted}
				type="monochrome"
			/>
		</View>
	);
}
