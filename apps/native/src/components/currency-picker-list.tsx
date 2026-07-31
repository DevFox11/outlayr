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
	contentShape,
	font,
	foregroundStyle,
	frame,
	kerning,
	labelStyle,
	lineLimit,
	listRowBackground,
	listRowInsets,
	listRowSeparator,
	listStyle,
	onTapGesture,
	padding,
	scrollContentBackground,
	shapes,
	textCase,
	tint,
} from "@expo/ui/swift-ui/modifiers";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Tick02Icon } from "@hugeicons-pro/core-stroke-rounded";
import { CURRENCY_META } from "@outlayr/money";
import { useMemo } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import {
	type CurrencyCode,
	type CurrencyPickerSection,
	currencyPickerSections,
} from "@/domain/currency-picker-rows";
import { FAVOURITE_CURRENCY_LIMIT } from "@/domain/favourite-currencies";
import { useTranslation } from "@/i18n";
import { useHaptics } from "@/lib/use-haptics";
import { type ThemeColors, useColors } from "@/theme/use-colors";

const ROW_INSETS = { bottom: 0, leading: 20, top: 0, trailing: 20 };

const SYMBOL_WIDTH = 42;
const ROW_SPACING = 12;

/**
 * SwiftUI puts a row's own padding outside its content, so a `Divider` drawn as
 * the last child hugs the text. The vertical padding moves onto the content and
 * the divider takes the leading inset the symbol column occupies.
 */
const ROW_PADDING = 9;

interface CurrencyPickerListProps {
	favourites: readonly string[];
	query: string;
	selected: string;
	onSelect: (code: string) => void;
	/** `null` while no database is open, so favouriting is absent rather than dead. */
	onToggleFavourite: ((code: string, favourite: boolean) => void) | null;
	style?: StyleProp<ViewStyle>;
}

export function CurrencyPickerList({
	favourites,
	query,
	selected,
	onSelect,
	onToggleFavourite,
	style,
}: CurrencyPickerListProps) {
	const colors = useColors();
	const haptics = useHaptics();
	const t = useTranslation();

	const sections = useMemo<CurrencyPickerSection[]>(
		() => currencyPickerSections(favourites, query),
		[favourites, query],
	);

	const full = favourites.length >= FAVOURITE_CURRENCY_LIMIT;

	// Answers only the refusal this row can already see. `favourites` comes from a
	// live query, so two rows pressed a tick apart at seven favourites both render
	// as not-full; the caller owns the outcome haptic because only the write knows.
	const toggle = (code: CurrencyCode, favourite: boolean) => {
		if (!favourite && full) {
			haptics("warning");
			return;
		}
		onToggleFavourite?.(code, favourite);
	};

	return (
		<Host style={style}>
			{/* The list's own ground is hidden and every row paints `--background`
			    instead: a plain list's sticky section header otherwise sits on a
			    system material that no token can match. The opaque row is also what
			    UIKit snapshots for the context-menu platter. */}
			<List modifiers={[listStyle("plain"), scrollContentBackground("hidden")]}>
				{sections.map((section) => (
					<Section
						header={
							section.section === null ? undefined : (
								<SectionHeader
									background={colors.background}
									label={t(
										section.section === "favourites"
											? "settings.currency.favourites"
											: "settings.currency.all",
									)}
								/>
							)
						}
						key={section.key}
					>
						{section.hint ? (
							<HintRow
								background={colors.background}
								label={t("settings.currency.favouritesHint")}
							/>
						) : null}
						{section.rows.map((row) => (
							<CurrencyRow
								code={row.code}
								colors={colors}
								favourite={row.favourite}
								full={full}
								key={row.key}
								onPress={() => onSelect(row.code)}
								onToggle={
									onToggleFavourite === null
										? null
										: () => toggle(row.code, row.favourite)
								}
								selected={row.code === selected}
							/>
						))}
					</Section>
				))}
			</List>
		</Host>
	);
}

function SectionHeader({
	background,
	label,
}: {
	background: string;
	label: string;
}) {
	return (
		<HStack
			modifiers={[listRowInsets(ROW_INSETS), listRowBackground(background)]}
		>
			<SwiftText
				modifiers={[
					font({ family: "GeistMono_400Regular", size: 11 }),
					kerning(1.2),
					textCase("uppercase"),
					foregroundStyle("secondary"),
				]}
			>
				{label}
			</SwiftText>
			<Spacer />
		</HStack>
	);
}

function HintRow({ background, label }: { background: string; label: string }) {
	return (
		<HStack
			modifiers={[
				listRowInsets(ROW_INSETS),
				listRowBackground(background),
				listRowSeparator("hidden"),
				padding({ bottom: ROW_PADDING }),
			]}
		>
			<SwiftText
				modifiers={[
					font({ family: "SFProRounded-Regular", size: 13 }),
					foregroundStyle("secondary"),
				]}
			>
				{label}
			</SwiftText>
			<Spacer />
		</HStack>
	);
}

function CurrencyRow({
	code,
	colors,
	favourite,
	full,
	onPress,
	onToggle,
	selected,
}: {
	code: CurrencyCode;
	colors: ThemeColors;
	favourite: boolean;
	full: boolean;
	onPress: () => void;
	onToggle: (() => void) | null;
	selected: boolean;
}) {
	const t = useTranslation();
	const meta = CURRENCY_META[code];
	const refuses = !favourite && full;

	const toggleLabel = refuses
		? t("settings.currency.favouritesFullShort", {
				limit: FAVOURITE_CURRENCY_LIMIT,
			})
		: t(
				favourite
					? "settings.currency.unfavouriteAction"
					: "settings.currency.favouriteAction",
			);

	// `onTapGesture`, not a `Button`: a `Button` nested in a `ContextMenu.Trigger`
	// never delivers its `onPress`. `contentShape` is what makes the whole row
	// tappable — without it only the glyphs themselves hit-test, so every press
	// landing in the gap between the name and the tick was swallowed.
	const content = (
		<VStack spacing={0}>
			<HStack
				modifiers={[
					padding({ vertical: ROW_PADDING }),
					contentShape(shapes.rectangle()),
					onTapGesture(onPress),
				]}
				spacing={ROW_SPACING}
			>
				<SwiftText
					modifiers={[
						font({ family: "SFProRounded-Regular", size: 16 }),
						frame({ width: SYMBOL_WIDTH }),
						lineLimit(1),
						foregroundStyle("secondary"),
					]}
				>
					{meta.symbol}
				</SwiftText>
				<VStack alignment="leading" spacing={1}>
					<SwiftText
						modifiers={[font({ family: "SFProRounded-Regular", size: 16 })]}
					>
						{code}
					</SwiftText>
					<SwiftText
						modifiers={[
							font({ family: "SFProRounded-Regular", size: 13 }),
							foregroundStyle("secondary"),
							lineLimit(1),
						]}
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
			<Divider modifiers={[padding({ leading: SYMBOL_WIDTH + ROW_SPACING })]} />
		</VStack>
	);

	const rowModifiers = [
		listRowInsets(ROW_INSETS),
		listRowBackground(colors.background),
		listRowSeparator("hidden"),
	];

	if (onToggle === null) {
		return <VStack modifiers={rowModifiers}>{content}</VStack>;
	}

	return (
		<SwipeActions modifiers={rowModifiers}>
			<ContextMenu>
				<ContextMenu.Items>
					<Button
						label={
							refuses
								? t("settings.currency.favouritesFull", {
										limit: FAVOURITE_CURRENCY_LIMIT,
									})
								: t(
										favourite
											? "settings.currency.unfavourite"
											: "settings.currency.favourite",
										{ code },
									)
						}
						onPress={onToggle}
						systemImage={favourite ? "star.slash" : "star"}
					/>
					<Button
						label={t("settings.currency.use", { code })}
						onPress={onPress}
						systemImage="checkmark"
					/>
				</ContextMenu.Items>
				<ContextMenu.Trigger>{content}</ContextMenu.Trigger>
			</ContextMenu>

			{/* `systemImage` only: this button renders its `label` and `systemImage`
			    and drops child views, so neither `RNHostView` nor the app's own
			    `.symbolset` reaches the lane. */}
			<SwipeActions.Actions edge="trailing">
				<Button
					label={toggleLabel}
					modifiers={[
						tint(
							refuses
								? colors.surfaceSecondary
								: favourite
									? colors.dangerFill
									: colors.goldFill,
						),
						labelStyle("iconOnly"),
					]}
					onPress={onToggle}
					systemImage={favourite || refuses ? "star.slash.fill" : "star.fill"}
				/>
			</SwipeActions.Actions>
		</SwipeActions>
	);
}
