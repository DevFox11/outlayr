import { View } from "react-native";

import { Text } from "@/components/text";
import { amountDigits, amountParts, withCurrencySymbol } from "@/domain/money";
import { useLanguage } from "@/i18n/context";

const TABULAR = { fontVariant: ["tabular-nums" as const] };

/**
 * Scaled by hand rather than by a text style: the figure has to stay
 * proportionate to the body-sized ledger underneath it.
 */
const FONT_SIZE = 40;

interface LogHeroNumberProps {
	/** The currency the figure is denominated in — not always the global one. */
	code: string;
	/** Unsigned magnitude; the sign is passed separately. */
	magnitude: number;
	positive: boolean;
	showCents?: boolean;
}

export function LogHeroNumber({ magnitude, code, positive, showCents = true }: LogHeroNumberProps) {
	const { language } = useLanguage();
	const parts = amountParts(magnitude, code, showCents, language);
	const digits = amountDigits(parts);
	const sign = positive ? "+" : "-";
	// The row's own `gap-1` spaces the symbol, so the locale's glue would double it.
	const trailing = parts.locale.placement === "suffix";
	const leading = !trailing;
	// Sized down as the symbol lengthens: a one-character "$" can sit close to the
	// figure, but a four-character "Bs.D" at the same weight reads as part of it.
	const symbolSize = FONT_SIZE * (parts.symbol.length > 1 ? 0.44 : 0.6);
	const symbol = (
		<Text className="font-sans text-muted" numberOfLines={1} style={{ fontSize: symbolSize }}>
			{leading ? sign : null}
			{parts.symbol}
		</Text>
	);

	return (
		<View
			accessibilityLabel={`${sign}${withCurrencySymbol(parts, digits)}`}
			// Symbol and digits are one figure, not two things to swipe between.
			accessible
			className="flex-row items-baseline gap-1"
		>
			{leading ? symbol : null}
			<Text
				adjustsFontSizeToFit
				className="shrink font-sans text-foreground"
				minimumFontScale={0.5}
				numberOfLines={1}
				style={[TABULAR, { fontSize: FONT_SIZE }]}
			>
				{trailing ? sign : null}
				{digits}
			</Text>
			{trailing ? symbol : null}
		</View>
	);
}
