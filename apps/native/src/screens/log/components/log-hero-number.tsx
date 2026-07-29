import { View } from "react-native";

import { Text } from "@/components/text";
import { amountParts } from "@/domain/money";

const TABULAR = { fontVariant: ["tabular-nums" as const] };

/**
 * Scaled by hand rather than by a text style: the figure has to stay
 * proportionate to the body-sized ledger underneath it.
 */
const FONT_SIZE = 40;

interface LogHeroNumberProps {
	/** Unsigned magnitude; the sign is passed separately. */
	magnitude: number;
	/** The currency the figure is denominated in — not always the global one. */
	code: string;
	positive: boolean;
	showCents?: boolean;
}

export function LogHeroNumber({
	magnitude,
	code,
	positive,
	showCents = true,
}: LogHeroNumberProps) {
	const parts = amountParts(magnitude, code, showCents);
	const digits = parts.fraction
		? `${parts.integer}.${parts.fraction}`
		: parts.integer;
	// Sized down as the symbol lengthens: a one-character "$" can sit close to the
	// figure, but a four-character "Bs.D" at the same weight reads as part of it.
	const symbolSize = FONT_SIZE * (parts.symbol.length > 1 ? 0.44 : 0.6);

	return (
		<View
			className="flex-row items-baseline gap-1"
			// Symbol and digits are one figure, not two things to swipe between.
			accessible
			accessibilityLabel={`${positive ? "+" : "-"}${parts.symbol}${digits}`}
		>
			<Text
				className="font-sans text-muted"
				style={{ fontSize: symbolSize }}
				numberOfLines={1}
			>
				{positive ? "+" : "-"}
				{parts.symbol}
			</Text>
			<Text
				className="shrink font-sans text-foreground"
				style={[TABULAR, { fontSize: FONT_SIZE }]}
				numberOfLines={1}
				adjustsFontSizeToFit
				minimumFontScale={0.5}
			>
				{digits}
			</Text>
		</View>
	);
}
