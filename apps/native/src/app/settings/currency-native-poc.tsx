/**
 * THROWAWAY proof of concept: the currency picker on a native SwiftUI `List`
 * instead of a `FlatList`. Reach it at `outlayr:///settings/currency-native-poc`.
 */

import { Host } from "@expo/ui";
import {
	Button,
	ContextMenu,
	Divider,
	HStack,
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
	kerning,
	labelStyle,
	lineLimit,
	listRowInsets,
	listRowSeparator,
	listStyle,
	onTapGesture,
	padding,
	textCase,
	tint,
} from "@expo/ui/swift-ui/modifiers";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Tick02Icon } from "@hugeicons-pro/core-stroke-rounded";
import { CURRENCY_META, PICKABLE_CURRENCY_CODES } from "@outlayr/money";
import { Stack } from "expo-router";
import { useState } from "react";
import { useColors } from "@/theme/use-colors";

const ALL = PICKABLE_CURRENCY_CODES;

const ROW_INSETS = { bottom: 0, leading: 20, top: 0, trailing: 20 };

const SYMBOL_WIDTH = 42;
const ROW_SPACING = 12;

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
				<List modifiers={[listStyle("plain")]}>
					<Section header={<SectionHeader section="favourites" />}>
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

					<Section header={<SectionHeader section="all" />}>
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

function SectionHeader({ section }: { section: "favourites" | "all" }) {
	return (
		<HStack modifiers={[listRowInsets(ROW_INSETS)]}>
			<SwiftText
				modifiers={[
					font({ family: "GeistMono_400Regular", size: 11 }),
					kerning(1.2),
					textCase("uppercase"),
					foregroundStyle("secondary"),
				]}
			>
				{section === "favourites" ? "Favourites" : "All currencies"}
			</SwiftText>
			<Spacer />
		</HStack>
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
		<SwipeActions
			modifiers={[listRowInsets(ROW_INSETS), listRowSeparator("hidden")]}
		>
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
					<VStack modifiers={[onTapGesture(onPress)]} spacing={0}>
						<HStack spacing={ROW_SPACING}>
							<SwiftText
								modifiers={[
									frame({ width: SYMBOL_WIDTH }),
									lineLimit(1),
									foregroundStyle("secondary"),
								]}
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
						<Divider
							modifiers={[padding({ leading: SYMBOL_WIDTH + ROW_SPACING })]}
						/>
					</VStack>
				</ContextMenu.Trigger>
			</ContextMenu>

			{/* `systemImage` only: this button drops child views, `RNHostView`
			    renders blank, and `Image.uiImage` cannot be templated or sized. */}
			<SwipeActions.Actions edge="trailing">
				<Button
					label={favourite ? "Unfavourite" : "Favourite"}
					modifiers={[
						tint(favourite ? "#da0f01" : "#8a6a14"),
						labelStyle("iconOnly"),
					]}
					onPress={onToggle}
					systemImage={favourite ? "star.slash.fill" : "star.fill"}
				/>
			</SwipeActions.Actions>
		</SwipeActions>
	);
}
