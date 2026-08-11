import { LineChart } from "panelui-native";
import { useMemo } from "react";
import { View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { Text } from "@/components/text";
import { useSettingBool } from "@/contexts/display-settings-context";
import { accountBalanceSeries } from "@/domain/account-balance-series";
import { formatSignedAmount } from "@/domain/account-display";
import type { CurrencyCell } from "@/domain/currency-totals";
import { monthAbbrevTitle } from "@/domain/dates";
import type { RateTable } from "@/domain/valuation";
import { useLanguage, useTranslation } from "@/i18n/context";
import { CHART_DRAW, compactMagnitude } from "@/theme/chart";
import { useColors } from "@/theme/use-colors";

interface AccountBalanceChartProps {
	account: {
		currency: string;
		initialBalance: number;
		initialBalanceDate: Date;
	};
	cells: readonly CurrencyCell[];
	now?: Date;
	rates: RateTable;
	showCents: boolean;
}

function dateFromKey(dateKey: string): Date {
	return new Date(`${dateKey}T12:00:00`);
}

function formatDate(dateKey: string, language: "en" | "es"): string {
	const date = dateFromKey(dateKey);
	return `${date.getDate()} ${monthAbbrevTitle(date, language)}`;
}

function balanceDomain(values: readonly number[]): [number, number] {
	let minimum = Number.POSITIVE_INFINITY;
	let maximum = Number.NEGATIVE_INFINITY;
	for (const value of values) {
		minimum = Math.min(minimum, value);
		maximum = Math.max(maximum, value);
	}
	if (!(Number.isFinite(minimum) && Number.isFinite(maximum))) {
		return [-1, 1];
	}
	if (minimum === maximum) {
		const padding = Math.max(Math.abs(minimum) * 0.1, 1);
		return [minimum - padding, maximum + padding];
	}
	const boundedMinimum = Math.min(0, minimum);
	const boundedMaximum = Math.max(0, maximum);
	const padding = (boundedMaximum - boundedMinimum) * 0.1;
	return [boundedMinimum - padding, boundedMaximum + padding];
}

export function AccountBalanceChart({ account, cells, now = new Date(), rates, showCents }: AccountBalanceChartProps) {
	const colors = useColors();
	const t = useTranslation();
	const { language } = useLanguage();
	const reduceMotion = useReducedMotion();
	const animated = useSettingBool("animatedCharts") && !reduceMotion;
	const data = useMemo(
		() =>
			accountBalanceSeries(account, cells, rates, now).map(({ date, exact, value }) => ({
				date,
				exact: exact ? 1 : 0,
				value,
			})),
		[account, cells, now, rates]
	);
	const domain = useMemo(() => balanceDomain(data.map((point) => point.value)), [data]);
	const latest = data.at(-1) ?? { date: "", exact: 1, value: 0 };
	const summary = t(latest.exact === 1 ? "accounts.chart.summary" : "accounts.chart.summaryApproximate", {
		amount: formatSignedAmount(latest.value, account.currency, showCents, language),
		date: formatDate(latest.date, language),
	});
	const tooltipDate = (datum: { date?: string | number | null; exact?: string | number | null }): string => {
		const date = formatDate(String(datum.date ?? ""), language);
		return datum.exact === 0 ? `${date} · ${t("accounts.chart.approximate")}` : date;
	};

	return (
		<View className="w-full gap-2 pt-4">
			<View accessibilityLabel={summary} accessibilityRole="image" accessible testID="account-balance-summary">
				<Text className="font-sans-semibold text-foreground text-subtitle">{t("accounts.chart.heading")}</Text>
				<Text className="text-footnote text-muted">{summary}</Text>
			</View>
			<View
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
				testID="account-balance-panel-chart"
			>
				<LineChart
					animationDuration={animated ? CHART_DRAW.durationMs : 0}
					aspectRatio={2.2}
					data={data}
					domainDuration={animated ? CHART_DRAW.durationMs : 0}
					xDataKey="date"
					yDomain={domain}
				>
					<LineChart.Grid rows={2} />
					<LineChart.Area color={colors.tint} dataKey="value" opacity={0.12} />
					<LineChart.Line color={colors.tint} dataKey="value" strokeWidth={2.5} />
					<LineChart.XAxis format={tooltipDate} ticks={3} />
					<LineChart.YAxis format={(value) => compactMagnitude(value)} ticks={2} />
					<LineChart.Tooltip
						formatValue={(value) => formatSignedAmount(value, account.currency, showCents, language)}
						formatX={tooltipDate}
					/>
				</LineChart>
			</View>
		</View>
	);
}
