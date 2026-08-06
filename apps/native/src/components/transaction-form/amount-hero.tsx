import {
	Button,
	HStack,
	Image,
	Spacer,
	Text as SwiftText,
	VStack,
} from "@expo/ui/swift-ui";
import {
	background,
	buttonStyle,
	contentShape,
	font,
	foregroundStyle,
	lineLimit,
	minimumScaleFactor,
	monospacedDigit,
	padding,
	shapes,
} from "@expo/ui/swift-ui/modifiers";

const SYMBOL = font({ size: 30, weight: "medium", design: "rounded" });
const DIGITS = font({ size: 62, weight: "semibold", design: "rounded" });
const CHIP = font({ size: 15, weight: "semibold", design: "rounded" });
const CURRENCY = font({ size: 14, weight: "medium", design: "rounded" });
const CAPSULE = shapes.capsule();

interface TransactionFormAmountHeroProps {
	symbol: string;
	digits: string;
	currency: string;
	amountColor: string;
	mutedColor: string;
	chipColor: string;
	income: boolean;
	expenseLabel: string;
	incomeLabel: string;
	onTypeChange: (next: "expense" | "income") => void;
	onPress: () => void;
	onCurrencyPress: () => void;
}

export function TransactionFormAmountHero({
	symbol,
	digits,
	currency,
	amountColor,
	mutedColor,
	chipColor,
	income,
	expenseLabel,
	incomeLabel,
	onTypeChange,
	onPress,
	onCurrencyPress,
}: TransactionFormAmountHeroProps) {
	const chip = (selected: boolean) =>
		selected
			? [
					CHIP,
					foregroundStyle(amountColor),
					padding({ horizontal: 18, vertical: 9 }),
					background(chipColor, CAPSULE),
				]
			: [
					CHIP,
					foregroundStyle(mutedColor),
					padding({ horizontal: 18, vertical: 9 }),
				];

	return (
		<VStack spacing={14}>
			<HStack spacing={2}>
				<Spacer />
				<Button
					modifiers={[buttonStyle("plain")]}
					onPress={() => onTypeChange("expense")}
				>
					<SwiftText modifiers={chip(!income)}>{expenseLabel}</SwiftText>
				</Button>
				<Button
					modifiers={[buttonStyle("plain")]}
					onPress={() => onTypeChange("income")}
				>
					<SwiftText modifiers={chip(income)}>{incomeLabel}</SwiftText>
				</Button>
				<Spacer />
			</HStack>

			<Button
				modifiers={[buttonStyle("plain"), contentShape(shapes.rectangle())]}
				onPress={onPress}
			>
				<HStack alignment="lastTextBaseline" spacing={3}>
					<Spacer />
					<SwiftText modifiers={[SYMBOL, foregroundStyle(mutedColor)]}>
						{symbol}
					</SwiftText>
					<SwiftText
						modifiers={[
							DIGITS,
							monospacedDigit(),
							foregroundStyle(amountColor),
							lineLimit({ min: 1, max: 1 }),
							minimumScaleFactor(0.5),
						]}
					>
						{digits}
					</SwiftText>
					<Spacer />
				</HStack>
			</Button>

			<HStack>
				<Spacer />
				<Button modifiers={[buttonStyle("plain")]} onPress={onCurrencyPress}>
					<HStack
						modifiers={[
							padding({ horizontal: 14, vertical: 7 }),
							background(chipColor, CAPSULE),
						]}
						spacing={5}
					>
						<SwiftText modifiers={[CURRENCY, foregroundStyle(amountColor)]}>
							{currency}
						</SwiftText>
						<Image
							color={mutedColor}
							size={11}
							systemName="chevron.up.chevron.down"
						/>
					</HStack>
				</Button>
				<Spacer />
			</HStack>
		</VStack>
	);
}
