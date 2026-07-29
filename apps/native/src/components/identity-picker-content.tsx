import { Host } from "@expo/ui";
import {
	Button,
	ColorPicker,
	HStack,
	Picker,
	RNHostView,
	ScrollView,
	Spacer,
	Image as SwiftImage,
	Text as SwiftText,
	TextField,
	useNativeState,
	VStack,
} from "@expo/ui/swift-ui";
import {
	background,
	buttonStyle,
	fixedSize,
	font,
	foregroundStyle,
	labelsHidden,
	padding,
	pickerStyle,
	shapes,
	tag,
	textCase,
	textInputAutocapitalization,
} from "@expo/ui/swift-ui/modifiers";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { PlatformColor, Pressable, useWindowDimensions } from "react-native";
import {
	ColorSwatch,
	SYMBOL_COLUMNS,
	SYMBOL_GAP,
	SYMBOL_MARGIN,
	SymbolEmojiCell,
	SymbolIconCell,
	symbolCellSize,
} from "@/components/identity-symbol-cells";
import { CATEGORY_PALETTE } from "@/data/categories";
import {
	CATEGORY_EMOJI_GROUPS,
	CATEGORY_ICON_GROUPS,
	iconKeysMatching,
} from "@/domain/category-icon-catalog";
import { persistPickedPhoto } from "@/lib/photo-storage";
import { glowFromImage } from "@/theme/glow";
import { withAlpha } from "@/theme/shade";
import { SYSTEM_COLORS, useColors } from "@/theme/use-colors";

export type IdentitySelection = {
	emoji: string | null;
	icon: string | null;
	photoUri: string | null;
	/** Photo glow color — auto-detected from the image, overridable via the swatch. */
	photoColor: string | null;
	color: string | null;
};

export type IdentityTab = "photo" | "emoji" | "icons";

export const TRANSACTION_TABS: readonly IdentityTab[] = [
	"photo",
	"emoji",
	"icons",
];
/** A category is a glyph, never a photo. */
export const CATEGORY_TABS: readonly IdentityTab[] = ["icons", "emoji"];

const TAB_LABEL: Record<IdentityTab, string> = {
	photo: "Photo",
	emoji: "Emoji",
	icons: "Icons",
};

const SECONDARY_LABEL = PlatformColor("secondaryLabel");
const SEARCH_FIELD_BACKGROUND = PlatformColor("systemGray6");
const SEARCH_FIELD_SHAPE = shapes.roundedRectangle({
	cornerRadius: 10,
	roundedCornerStyle: "continuous",
});
const CARD_SHAPE = shapes.roundedRectangle({
	cornerRadius: 14,
	roundedCornerStyle: "continuous",
});

const GROUP_TITLE = font({
	textStyle: "subheadline",
	design: "rounded",
	weight: "semibold",
});
const SECTION_LABEL = font({
	textStyle: "caption",
	design: "rounded",
	weight: "semibold",
});
const EMPTY_TEXT = font({ textStyle: "subheadline", design: "rounded" });
const SUBHEADLINE = font({ textStyle: "subheadline", design: "rounded" });
const CAPTION2 = font({ textStyle: "caption2", design: "rounded" });

/** App-icon squircle for the photo well (radius ≈ 0.226 · size, matching the hero). */
const PHOTO_WELL = 132;
const PHOTO_WELL_RADIUS = 30;

function chunk<T>(items: readonly T[], size: number): T[][] {
	const rows: T[][] = [];
	for (let index = 0; index < items.length; index += size) {
		rows.push(items.slice(index, index + size));
	}
	return rows;
}

function initialTab(
	value: IdentitySelection,
	tabs: readonly IdentityTab[],
): IdentityTab {
	if (value.icon && tabs.includes("icons")) {
		return "icons";
	}
	if (value.emoji && tabs.includes("emoji")) {
		return "emoji";
	}
	if (value.photoUri && tabs.includes("photo")) {
		return "photo";
	}
	return tabs[0];
}

export interface IdentityPickerContentProps {
	value: IdentitySelection;
	onChange: (next: IdentitySelection) => void;
	/** Which tabs the sheet offers, in display order. */
	tabs?: readonly IdentityTab[];
	/** Glyph wash / highlight color: the chosen category color, or income green. */
	tint?: string;
	/** Colors sibling expense categories already own; dimmed and unpickable. */
	usedColors?: readonly string[];
	/** Off for income and for subcategories. */
	showsColorRail?: boolean;
	onDone: () => void;
}

/**
 * The identity picker's content, shared by the transaction sheet
 * (`transaction/identity`) and the category one (`settings/category-symbol`).
 *
 * The enclosing `<Host>` and the sheet chrome belong to the route.
 */
export function IdentityPickerContent({
	value,
	onChange,
	tabs = TRANSACTION_TABS,
	tint,
	usedColors = [],
	showsColorRail = true,
	onDone,
}: IdentityPickerContentProps) {
	const { width } = useWindowDimensions();
	const cell = symbolCellSize(width);
	const [tab, setTab] = useState<IdentityTab>(() => initialTab(value, tabs));
	// Both halves of the same field: the native state so the clear button can empty
	// it, the React one so the results recompute.
	const queryState = useNativeState("");
	const [query, setQuery] = useState("");
	const searching = query.trim() !== "";
	const searchResults = searching ? iconKeysMatching(query) : [];

	const effectiveColor = value.color ?? CATEGORY_PALETTE[0];
	const glyphTint = tint ?? effectiveColor;

	const pickColor = (color: string) => {
		Haptics.selectionAsync();
		onChange({ ...value, color });
	};
	const pickEmoji = (emoji: string) => {
		Haptics.selectionAsync();
		onChange({
			emoji,
			icon: null,
			photoUri: null,
			photoColor: null,
			color: value.color,
		});
	};
	const pickIcon = (icon: string) => {
		Haptics.selectionAsync();
		onChange({
			emoji: null,
			icon,
			photoUri: null,
			photoColor: null,
			color: value.color ?? CATEGORY_PALETTE[0],
		});
	};

	const pickPhoto = async () => {
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ["images"],
			allowsEditing: true,
			aspect: [1, 1],
			quality: 0.9,
		});
		if (result.canceled || result.assets.length === 0) {
			return;
		}
		const picked = result.assets[0].uri;
		// A failed copy still leaves a usable picture for this session, and the
		// launch reconcile adopts it while the cache entry survives.
		const uri = await persistPickedPhoto(picked).catch((error) => {
			console.error("Failed to store the picked photo", error);
			return picked;
		});
		const hues = await glowFromImage(uri);
		onChange({
			emoji: null,
			icon: null,
			photoUri: uri,
			photoColor: hues[0] ?? null,
			color: value.color,
		});
	};

	return (
		<VStack
			modifiers={[background(SYSTEM_COLORS.groupedBackground)]}
			spacing={0}
		>
			<HStack modifiers={[padding({ horizontal: 20, top: 16, bottom: 8 })]}>
				<Spacer />
				<Button
					label="Done"
					modifiers={[font({ weight: "semibold" })]}
					onPress={onDone}
				/>
			</HStack>

			<Picker
				modifiers={[
					pickerStyle("segmented"),
					padding({ horizontal: 20, bottom: 12 }),
				]}
				onSelectionChange={(next) => setTab(next as IdentityTab)}
				selection={tab}
			>
				{tabs.map((option) => (
					<SwiftText key={option} modifiers={[tag(option)]}>
						{TAB_LABEL[option]}
					</SwiftText>
				))}
			</Picker>

			{/* The emoji palette has no keywords to search against. */}
			{tab === "icons" ? (
				<HStack
					modifiers={[
						padding({ horizontal: 10, vertical: 8 }),
						background(SEARCH_FIELD_BACKGROUND, SEARCH_FIELD_SHAPE),
						padding({ horizontal: 20, bottom: 12 }),
					]}
					spacing={8}
				>
					<SwiftImage
						color={SECONDARY_LABEL}
						size={15}
						systemName="magnifyingglass"
					/>
					<TextField
						modifiers={[textInputAutocapitalization("never")]}
						onTextChange={setQuery}
						placeholder="Search icons"
						text={queryState}
					/>
					{searching ? (
						<Button
							modifiers={[buttonStyle("plain")]}
							onPress={() => {
								queryState.set("");
								setQuery("");
							}}
						>
							<SwiftImage
								color={SECONDARY_LABEL}
								size={15}
								systemName="xmark.circle.fill"
							/>
						</Button>
					) : null}
				</HStack>
			) : null}

			{/* The photo tab carries its own colour control, so the rail belongs to
			    the glyph tabs alone. */}
			{showsColorRail && tab !== "photo" ? (
				<ColorRail
					onSelect={pickColor}
					selected={value.color}
					usedColors={usedColors}
				/>
			) : null}

			<ScrollView showsIndicators={false}>
				{tab === "photo" ? (
					<PhotoPanel
						onColorChange={(color) => onChange({ ...value, photoColor: color })}
						onPick={pickPhoto}
						photoColor={value.photoColor}
						uri={value.photoUri}
					/>
				) : tab === "emoji" ? (
					<VStack
						alignment="leading"
						modifiers={[padding({ horizontal: SYMBOL_MARGIN, bottom: 24 })]}
						spacing={20}
					>
						{CATEGORY_EMOJI_GROUPS.map((group) => (
							<VStack
								alignment="leading"
								key={group.title}
								spacing={SYMBOL_GAP}
							>
								<GroupHeader title={group.title} />
								<EmojiRows
									cell={cell}
									emojis={group.emoji}
									onSelect={pickEmoji}
									selectedEmoji={value.emoji ?? ""}
									tint={glyphTint}
								/>
							</VStack>
						))}
					</VStack>
				) : searching ? (
					searchResults.length === 0 ? (
						<VStack modifiers={[padding({ top: 60 })]}>
							<SwiftText
								modifiers={[EMPTY_TEXT, foregroundStyle(SECONDARY_LABEL)]}
							>
								No icons found
							</SwiftText>
						</VStack>
					) : (
						<VStack
							alignment="leading"
							modifiers={[
								padding({ horizontal: SYMBOL_MARGIN, top: 4, bottom: 24 }),
							]}
						>
							<IconRows
								cell={cell}
								keys={searchResults}
								onSelect={pickIcon}
								selectedIcon={value.icon ?? ""}
								tint={glyphTint}
							/>
						</VStack>
					)
				) : (
					<VStack
						alignment="leading"
						modifiers={[padding({ horizontal: SYMBOL_MARGIN, bottom: 24 })]}
						spacing={20}
					>
						{CATEGORY_ICON_GROUPS.map((group) => (
							<VStack
								alignment="leading"
								key={group.title}
								spacing={SYMBOL_GAP}
							>
								<GroupHeader title={group.title} />
								<IconRows
									cell={cell}
									keys={group.keys}
									onSelect={pickIcon}
									selectedIcon={value.icon ?? ""}
									tint={glyphTint}
								/>
							</VStack>
						))}
					</VStack>
				)}
			</ScrollView>
		</VStack>
	);
}

/**
 * Not pinned: @expo/ui's ScrollView has no `pinnedViews` equivalent, so the
 * grouped background is only doing the header's own inset.
 */
function GroupHeader({ title }: { title: string }) {
	return (
		<SwiftText
			modifiers={[
				GROUP_TITLE,
				foregroundStyle(SECONDARY_LABEL),
				padding({ vertical: 8 }),
			]}
		>
			{title}
		</SwiftText>
	);
}

function IconRows({
	keys,
	tint,
	selectedIcon,
	cell,
	onSelect,
}: {
	keys: readonly string[];
	tint: string;
	selectedIcon: string;
	cell: number;
	onSelect: (key: string) => void;
}) {
	return (
		<VStack alignment="leading" spacing={SYMBOL_GAP}>
			{chunk(keys, SYMBOL_COLUMNS).map((row, index) => (
				<HStack key={String(index)} spacing={SYMBOL_GAP}>
					{row.map((key) => (
						<RNHostView key={key} matchContents>
							<SymbolIconCell
								iconKey={key}
								onPress={() => onSelect(key)}
								selected={key === selectedIcon}
								size={cell}
								tint={tint}
							/>
						</RNHostView>
					))}
				</HStack>
			))}
		</VStack>
	);
}

function EmojiRows({
	emojis,
	tint,
	selectedEmoji,
	cell,
	onSelect,
}: {
	emojis: readonly string[];
	tint: string;
	selectedEmoji: string;
	cell: number;
	onSelect: (emoji: string) => void;
}) {
	return (
		<VStack alignment="leading" spacing={SYMBOL_GAP}>
			{chunk(emojis, SYMBOL_COLUMNS).map((row, index) => (
				<HStack key={String(index)} spacing={SYMBOL_GAP}>
					{row.map((emoji) => (
						<RNHostView key={emoji} matchContents>
							<SymbolEmojiCell
								emoji={emoji}
								onPress={() => onSelect(emoji)}
								selected={emoji === selectedEmoji}
								size={cell}
								tint={tint}
							/>
						</RNHostView>
					))}
				</HStack>
			))}
		</VStack>
	);
}

function ColorRail({
	selected,
	usedColors,
	onSelect,
}: {
	selected: string | null;
	usedColors: readonly string[];
	onSelect: (hex: string) => void;
}) {
	return (
		<ScrollView
			axes="horizontal"
			modifiers={[padding({ bottom: 8 })]}
			showsIndicators={false}
		>
			<HStack modifiers={[padding({ horizontal: 20 })]} spacing={12}>
				{CATEGORY_PALETTE.map((hex) => (
					<RNHostView key={hex} matchContents>
						<ColorSwatch
							hex={hex}
							onPress={() => onSelect(hex)}
							selected={selected === hex}
							used={usedColors.includes(hex)}
						/>
					</RNHostView>
				))}
				{/* Bare on purpose while the swatches above tick: the wheel streams a
				    colour for every finger move and would buzz for the whole drag. */}
				<ColorPicker
					label=""
					modifiers={[labelsHidden(), fixedSize()]}
					onSelectionChange={onSelect}
					selection={selected ?? CATEGORY_PALETTE[0]}
				/>
			</HStack>
		</ScrollView>
	);
}

/** Cropping is left to the system image picker's own square editor. */
function PhotoPanel({
	uri,
	photoColor,
	onPick,
	onColorChange,
}: {
	uri: string | null;
	photoColor: string | null;
	onPick: () => void;
	onColorChange: (color: string) => void;
}) {
	const colors = useColors();
	return (
		<VStack
			modifiers={[padding({ horizontal: SYMBOL_MARGIN, top: 6, bottom: 24 })]}
			spacing={0}
		>
			<RNHostView matchContents>
				<PhotoWell colors={colors} onPress={onPick} uri={uri} />
			</RNHostView>

			<SwiftText
				modifiers={[
					SUBHEADLINE,
					foregroundStyle(SECONDARY_LABEL),
					padding({ top: 10, bottom: 24 }),
				]}
			>
				{uri ? "Tap to change photo" : "Tap to select a photo"}
			</SwiftText>

			<VStack alignment="leading" spacing={8}>
				<SwiftText
					modifiers={[
						SECTION_LABEL,
						textCase("uppercase"),
						foregroundStyle(SECONDARY_LABEL),
					]}
				>
					Color
				</SwiftText>

				<HStack
					modifiers={[
						padding({ horizontal: 15, vertical: 13 }),
						background(SYSTEM_COLORS.card, CARD_SHAPE),
					]}
					spacing={12}
				>
					<SwiftImage
						color={uri ? colors.income : withAlpha(colors.muted, 0.35)}
						size={14}
						systemName="checkmark"
					/>
					<VStack alignment="leading" spacing={1}>
						<SwiftText modifiers={[SUBHEADLINE]}>Auto-detected</SwiftText>
						<SwiftText modifiers={[CAPTION2, foregroundStyle(SECONDARY_LABEL)]}>
							{uri ? "Primary color from image" : "Pick a photo first"}
						</SwiftText>
					</VStack>
					<Spacer />
					<ColorPicker
						label=""
						modifiers={[labelsHidden(), fixedSize()]}
						onSelectionChange={onColorChange}
						selection={photoColor ?? CATEGORY_PALETTE[0]}
					/>
				</HStack>
			</VStack>
		</VStack>
	);
}

function PhotoWell({
	uri,
	colors,
	onPress,
}: {
	uri: string | null;
	colors: ReturnType<typeof useColors>;
	onPress: () => void;
}) {
	return (
		<Pressable
			accessibilityLabel={uri ? "Change photo" : "Select photo"}
			accessibilityRole="button"
			onPress={onPress}
			style={({ pressed }) => ({
				width: PHOTO_WELL,
				height: PHOTO_WELL,
				borderRadius: PHOTO_WELL_RADIUS,
				overflow: "hidden",
				alignItems: "center",
				justifyContent: "center",
				opacity: pressed ? 0.8 : 1,
				backgroundColor: withAlpha(colors.muted, 0.12),
			})}
		>
			{uri ? (
				<Image
					contentFit="cover"
					source={{ uri }}
					style={{ width: PHOTO_WELL, height: PHOTO_WELL }}
				/>
			) : (
				<SymbolView
					name="photo"
					size={42}
					tintColor={colors.muted}
					type="monochrome"
				/>
			)}
		</Pressable>
	);
}

export function IdentityPickerHost(props: IdentityPickerContentProps) {
	return (
		<Host style={{ flex: 1 }}>
			<IdentityPickerContent {...props} />
		</Host>
	);
}
