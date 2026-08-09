import { Pressable, View } from "react-native";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import { useTranslation } from "@/i18n";
import { MeasureCellAmount } from "./amount-text";
import { MonoLabel } from "./mono-label";
import { cn } from "./tw";

export interface LedgerCell {
	/** Overrides the spoken hint, which otherwise says the figure is promotable. */
	accessibilityHint?: string;
	/**
	 * Whether the figure earns the income colour. Only money actually coming in
	 * does; a positive net is still just a net.
	 */
	income: boolean;
	key: string;
	/** One short word, so every cell fits across the narrowest phone. */
	label: string;
	/** Unsigned — the sign comes from `positive`, so 40 out and 40 in match. */
	magnitude: number;
	onPress: () => void;
	positive: boolean;
}

interface LedgerHeadProps {
	/** The measures the hero is *not* showing, in a stable declaration order. */
	cells: readonly LedgerCell[];
	code: string;
}

/**
 * The order of `cells` must not depend on which measure is promoted — the pair
 * reshuffling under your thumb is how you tap the wrong one.
 */
export function LedgerHead({ cells, code }: LedgerHeadProps) {
	const { showCents } = useDisplaySettings().state;
	const t = useTranslation();
	return (
		<View>
			<View className="h-px w-full bg-border" />
			<View className="flex-row">
				{cells.map((cell, index) => (
					<View className={cn("flex-1", index > 0 && "pl-3.5")} key={cell.key}>
						{/* Absolute so the rule spans the taller of the two columns
						    rather than only its own content. */}
						{index > 0 ? <View className="absolute inset-y-0 left-0 w-px bg-border" /> : null}
						<Pressable
							accessibilityHint={cell.accessibilityHint ?? t("log.ledger.showFigure")}
							accessibilityRole="button"
							className="gap-0.75 py-2.5 active:opacity-70"
							onPress={cell.onPress}
						>
							<MonoLabel>{cell.label}</MonoLabel>
							<MeasureCellAmount
								code={code}
								income={cell.income}
								magnitude={cell.magnitude}
								positive={cell.positive}
								showCents={showCents}
							/>
						</Pressable>
					</View>
				))}
			</View>
		</View>
	);
}
