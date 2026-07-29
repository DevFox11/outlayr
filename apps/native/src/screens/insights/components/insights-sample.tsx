import { Pressable, ScrollView, View } from "react-native";

import { HeroNumber } from "@/components/amount-text";
import { type LedgerCell, LedgerHead } from "@/components/ledger-head";
import { MonoLabel } from "@/components/mono-label";
import { LinearGradient } from "@/components/styled";
import { Text } from "@/components/text";
import type {
	CategoryBreakdownEntry,
	CategoryMover,
	InsightsBucket,
} from "@/data/insights";
import { withAlpha } from "@/theme/shade";
import { useColors } from "@/theme/use-colors";
import { CategoryBreakdownRow } from "./category-breakdown-row";
import { CategoryProportionBar } from "./category-proportion-bar";
import { InsightsBarChart } from "./insights-bar-chart";
import { InsightsMovers } from "./insights-movers";

const noop = () => undefined;

/**
 * 31 March 2026. Frozen rather than derived from the clock so the sample is the
 * same picture on every run, and so no bucket ever reads as pending.
 */
const FIXTURE_NOW = new Date(2026, 2, 31, 12, 0, 0, 0).getTime();

/** Daily spend for March 2026, in declaration order. Sums to 1840.50. */
const DAILY_SPEND = [
	62.4, 0, 50.9, 121.75, 44.9, 0, 88.3, 27.6, 135.2, 51.4, 0, 73.85, 182.6,
	34.1, 96.45, 0, 58.9, 112.35, 41.2, 0, 67.75, 129.4, 23.85, 0, 84.6, 178.9,
	36.25, 0, 92.15, 45.7, 0,
];

function marchBuckets(values: number[]): InsightsBucket[] {
	return values.map((value, index) => ({
		start: new Date(2026, 2, index + 1),
		end: new Date(2026, 2, index + 2),
		label: String(index + 1),
		value,
	}));
}

/** Lifted from the presets a fresh install actually seeds. */
const DINING = { icon: "Restaurant01", color: "#FF8A00" } as const;
const GROCERIES = { icon: "ShoppingCart01", color: "#34C759" } as const;

/*
 * The fixtures below are typed against the real `@/data/insights` shapes on
 * purpose: a field added to any of them must break compilation here rather than
 * quietly leave the sample showing something the real Insights tab no longer does.
 */
const SAMPLE_BUCKETS: InsightsBucket[] = marchBuckets(DAILY_SPEND);

const SAMPLE_CELLS: LedgerCell[] = [
	{
		key: "income",
		label: "Income",
		magnitude: 3200,
		positive: true,
		income: true,
		onPress: noop,
	},
	{
		key: "net",
		label: "Net",
		magnitude: 1359.5,
		positive: true,
		income: false,
		onPress: noop,
	},
];

const SAMPLE_MOVERS: CategoryMover[] = [
	{
		id: "dining",
		name: "Dining Out",
		color: DINING.color,
		icon: DINING.icon,
		emoji: null,
		delta: 180,
		fraction: 0.34,
	},
	{
		id: "groceries",
		name: "Groceries",
		color: GROCERIES.color,
		icon: GROCERIES.icon,
		emoji: null,
		delta: -95.4,
		fraction: -0.12,
	},
];

const SAMPLE_BREAKDOWN: CategoryBreakdownEntry[] = [
	{
		id: "dining",
		name: "Dining Out",
		color: DINING.color,
		icon: DINING.icon,
		emoji: null,
		amount: 699.4,
		fraction: 0.38,
		delta: null,
	},
	{
		id: "groceries",
		name: "Groceries",
		color: GROCERIES.color,
		icon: GROCERIES.icon,
		emoji: null,
		amount: 478.5,
		fraction: 0.26,
		delta: null,
	},
];

interface InsightsSampleProps {
	onAddTransaction: () => void;
}

/**
 * Fabricated figures in a finance app: the preview must keep its `Sample` marker
 * inside the content (so it survives a screenshot), take no touches, and stay
 * hidden from assistive tech — a screen reader must never read out invented money
 * as if it were the user's.
 */
export function InsightsSample({ onAddTransaction }: InsightsSampleProps) {
	const colors = useColors();

	return (
		// A fragment, not a wrapping View: UIKit hooks the large title to the first
		// descendant scroll view, and an extra container between the screen and the
		// ScrollView costs it that inset — the sample then renders up underneath the
		// title. The veil and the CTA ride as absolute siblings instead, which is how
		// `FloatingAddButton` already sits over the Log.
		<>
			{/* A ScrollView that does not scroll: it exists for the large-title inset. */}
			<ScrollView
				className="bg-background"
				accessibilityElementsHidden
				contentInsetAdjustmentBehavior="automatic"
				importantForAccessibility="no-hide-descendants"
				pointerEvents="none"
				scrollEnabled={false}
			>
				<View className="px-5 pt-2">
					<View className="self-start rounded-full bg-surface-secondary px-2 py-1">
						<MonoLabel>Sample</MonoLabel>
					</View>

					<View className="flex-row items-center justify-between pt-3.5">
						<MonoLabel>Spent · March</MonoLabel>
						{/* Spending less is the favourable direction, so the fall wears
					    income green rather than danger red. */}
						<View
							style={{
								borderRadius: 6,
								paddingHorizontal: 5,
								paddingVertical: 2,
								backgroundColor: withAlpha(colors.income, 0.2),
							}}
						>
							<Text
								className="font-sans-semibold text-footnote"
								style={{ color: colors.income }}
							>
								-12%
							</Text>
						</View>
					</View>

					<View className="pt-0.5">
						<HeroNumber
							amount={1840.5}
							code="USD"
							showCents
							sign="-"
							size={40}
							toneClass="text-foreground"
						/>
					</View>

					<Text className="pt-0.5 text-footnote text-muted">
						$251.00 less than February. Groceries alone gave back $95.40.
					</Text>

					<View className="pt-3">
						<LedgerHead cells={SAMPLE_CELLS} code="USD" showCents />
					</View>

					<View className="pt-4">
						<InsightsBarChart
							average={59}
							buckets={SAMPLE_BUCKETS}
							code="USD"
							measure="spent"
							nowMs={FIXTURE_NOW}
							onCommit={noop}
							onScrub={noop}
							period="month"
							selectedIndex={null}
						/>
					</View>

					<View className="pt-6">
						<InsightsMovers
							code="USD"
							measure="spent"
							movers={SAMPLE_MOVERS}
							priorLabel="February"
							showCents
						/>
					</View>

					<View className="pt-6">
						<View className="pb-3">
							<MonoLabel>Categories</MonoLabel>
						</View>
						<View className="pb-1">
							<CategoryProportionBar
								entries={SAMPLE_BREAKDOWN}
								onSelect={noop}
								selectedId={null}
							/>
						</View>
						<View className="pt-2">
							{SAMPLE_BREAKDOWN.map((entry) => (
								<CategoryBreakdownRow
									code="USD"
									entry={entry}
									key={entry.id}
									measure="spent"
									showCents
								/>
							))}
						</View>
					</View>
				</View>
			</ScrollView>

			<LinearGradient
				className="absolute inset-0"
				colors={[
					withAlpha(colors.background, 0),
					withAlpha(colors.background, 0.03),
					withAlpha(colors.background, 0.2),
					withAlpha(colors.background, 0.55),
					withAlpha(colors.background, 0.88),
					colors.background,
				]}
				locations={[0, 0.4, 0.56, 0.68, 0.78, 0.86]}
				pointerEvents="none"
			/>

			{/* Clears the floating tab bar, as `FloatingAddButton` does. */}
			<View className="absolute right-0 bottom-safe-offset-20 left-0 items-center px-8">
				<Text className="pb-1 text-center font-sans-semibold text-body text-foreground">
					This is what a month looks like
				</Text>
				<Text className="pb-5 text-center text-footnote text-muted">
					Yours starts filling in from your first entry.
				</Text>
				<Pressable
					accessibilityRole="button"
					className="rounded-full bg-accent px-7 py-3.5 active:opacity-80"
					onPress={onAddTransaction}
				>
					<Text className="font-sans-semibold text-accent-foreground text-body">
						Log your first expense
					</Text>
				</Pressable>
			</View>
		</>
	);
}
