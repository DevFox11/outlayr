/**
 * THROWAWAY. A proof of concept, not a route meant to ship — it exists to answer
 * one question: what does the currency picker gain and lose if its list is a
 * native SwiftUI `List` instead of a `FlatList` of React Native rows?
 *
 * Reach it with `outlayr:///settings/currency-native-poc`.
 */

import { Host } from "@expo/ui";
import {
	Button,
	ContextMenu,
	HStack,
	Image,
	Label,
	List,
	RNHostView,
	Section,
	Spacer,
	Text as SwiftText,
	SwipeActions,
	VStack,
} from "@expo/ui/swift-ui";
import {
	font,
	foregroundStyle,
	frame,
	onTapGesture,
	tint,
} from "@expo/ui/swift-ui/modifiers";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { StarIcon as StarSolidIcon } from "@hugeicons-pro/core-solid-rounded";
import { Tick02Icon } from "@hugeicons-pro/core-stroke-rounded";
import { CURRENCY_META, PICKABLE_CURRENCY_CODES } from "@outlayr/money";
import { Stack } from "expo-router";
import { useState } from "react";
import { useColors } from "@/theme/use-colors";

const ALL = PICKABLE_CURRENCY_CODES;

export default function CurrencyNativePocScreen() {
	const [favourites, setFavourites] = useState<string[]>([
		"USD",
		"EUR",
		"GBP",
		"JPY",
	]);
	const [selected, setSelected] = useState<string>("USD");

	const rest = ALL.filter((code) => !favourites.includes(code));

	const toggle = (code: string) => {
		setFavourites((current) =>
			current.includes(code)
				? current.filter((entry) => entry !== code)
				: [...current, code],
		);
	};

	return (
		<>
			<Stack.Screen options={{ title: "Currency (native List)" }} />
			<Host style={{ flex: 1 }}>
				<List>
					<Section title="Favourites">
						{/* `ForEach` is only here for `onMove` — drag to reorder, which the
						    React Native version cannot offer at all. The swipe comes from
						    `SwipeActions` on the row, not from `onDelete`. */}
						<List.ForEach
							onMove={(from, to) => {
								setFavourites((current) => {
									const next = [...current];
									const [moved] = next.splice(from[0], 1);
									next.splice(to > from[0] ? to - 1 : to, 0, moved);
									return next;
								});
							}}
						>
							{favourites.map((code) => (
								<Row
									code={code}
									favourite
									key={code}
									onPress={() => setSelected(code)}
									onToggle={() => toggle(code)}
									selected={code === selected}
								/>
							))}
						</List.ForEach>
					</Section>

					<Section title="All currencies">
						{rest.map((code) => (
							<Row
								code={code}
								favourite={false}
								key={code}
								onPress={() => setSelected(code)}
								onToggle={() => toggle(code)}
								selected={code === selected}
							/>
						))}
					</Section>
				</List>
			</Host>
		</>
	);
}

function Row({
	code,
	favourite,
	selected,
	onPress,
	onToggle,
}: {
	code: string;
	favourite: boolean;
	selected: boolean;
	onPress: () => void;
	onToggle: () => void;
}) {
	const colors = useColors();
	const meta = CURRENCY_META[code as keyof typeof CURRENCY_META];
	return (
		<SwipeActions>
			{/* No per-row `Host` here, unlike in a FlatList of React Native rows: the
			    whole `List` is already inside one, so the menu is just another SwiftUI
			    view in the same tree. */}
			<ContextMenu>
				<ContextMenu.Items>
					<Button
						label={favourite ? "Remove from favourites" : "Add to favourites"}
						onPress={onToggle}
						systemImage={favourite ? "star.slash" : "star"}
					/>
					<Button
						label={`Use ${code}`}
						onPress={onPress}
						systemImage="checkmark"
					/>
				</ContextMenu.Items>
				<ContextMenu.Trigger>
					<HStack modifiers={[onTapGesture(onPress)]} spacing={12}>
						<SwiftText
							modifiers={[frame({ width: 36 }), foregroundStyle("secondary")]}
						>
							{meta.symbol}
						</SwiftText>
						<VStack alignment="leading" spacing={1}>
							<SwiftText>{code}</SwiftText>
							<SwiftText
								modifiers={[foregroundStyle("secondary"), font({ size: 13 })]}
							>
								{meta.name}
							</SwiftText>
						</VStack>
						<Spacer />
						{/* Both marks are React Native subtrees, so the whole app design
						    system — Hugeicons, `useColors()` tokens — draws inside a SwiftUI
						    row. Nothing here is an SF Symbol. */}
						{favourite ? (
							<RNHostView matchContents>
								<HugeiconsIcon
									color={colors.gold}
									icon={StarSolidIcon}
									size={16}
								/>
							</RNHostView>
						) : null}
						{selected ? (
							<RNHostView matchContents>
								<HugeiconsIcon
									color={colors.tint}
									icon={Tick02Icon}
									size={20}
									strokeWidth={2.4}
								/>
							</RNHostView>
						) : null}
					</HStack>
				</ContextMenu.Trigger>
			</ContextMenu>

			{/* `allowsFullSwipe` defaults to true, so the full swipe is free and the
			    label is ours — no `onDelete`, no threshold, no latch.

			    How far styling reaches, measured rather than assumed: `tint` paints the
			    lane the same #8a6a14 / #da0f01 the React Native version uses, and the
			    label and symbol are ours.

			    The glyph is a Hugeicon, and the only route that gets one here is a
			    custom SF Symbol. The two that do not:
			      - `RNHostView` inside a swipe-action button renders blank, the same
			        way it does inside a Toggle or Picker label.
			      - `Image.uiImage` draws a PNG but cannot be templated — `ImageView`
			        calls `Image(uiImage:)` and never `.renderingMode(.template)` — and
			        cannot be sized either, because `applyImageModifier` implements
			        `resizable` alone and drops `frame`, so it grows until the label
			        clips it.
			    `assetName` names a `.symbolset` from `scripts/generate-symbolsets.ts`,
			    which IS a template: it takes the tint and scales like any system
			    symbol. */}
			<SwipeActions.Actions edge="trailing">
				<Button
					label={favourite ? "Unfavourite" : "Favourite"}
					modifiers={[tint(favourite ? "#da0f01" : "#8a6a14")]}
					onPress={onToggle}
				>
					<Label
						icon={<Image assetName={favourite ? "unfavourite" : "favourite"} />}
						title={favourite ? "Unfavourite" : "Favourite"}
					/>
				</Button>
			</SwipeActions.Actions>
		</SwipeActions>
	);
}
