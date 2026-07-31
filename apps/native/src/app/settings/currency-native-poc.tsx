/**
 * THROWAWAY proof of concept: the currency picker on a native SwiftUI `List`
 * instead of a `FlatList`. Reach it at `outlayr:///settings/currency-native-poc`.
 */

import { Host } from "@expo/ui";
import {
	Button,
	ContextMenu,
	HStack,
	Image,
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
						{/* `ForEach` is here for `onMove` only — the swipe comes from
						    `SwipeActions`, not `onDelete`. */}
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
			{/* No per-row `Host`: the whole `List` is already inside one. */}
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
						{/* Custom SF Symbol from `scripts/generate-symbolsets.ts`. */}
						<Image assetName="favourite" color={colors.gold} size={16} />
					</HStack>
				</ContextMenu.Trigger>
			</ContextMenu>

			{/* `allowsFullSwipe` defaults to true, so the full swipe is free.
			    `systemImage` is the only way to get a glyph here: this button drops
			    child views, `RNHostView` renders blank, and `Image.uiImage` can be
			    neither templated nor sized. A custom symbolset works everywhere else —
			    see the row above — but not in this slot. */}
			<SwipeActions.Actions edge="trailing">
				<Button
					label={favourite ? "Unfavourite" : "Favourite"}
					modifiers={[tint(favourite ? "#da0f01" : "#8a6a14")]}
					onPress={onToggle}
					systemImage={favourite ? "star.slash.fill" : "star.fill"}
				/>
			</SwipeActions.Actions>
		</SwipeActions>
	);
}
