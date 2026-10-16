import { useColors } from "@/theme/use-colors";

/**
 * The colour Insights draws its neutral series in: spending bars, the net
 * chart's surplus and its marker. Ink on iOS; `chart-ink.android.ts` takes the
 * scheme's primary. Income keeps its own colour on both, and the axes and
 * rules stay in the foreground.
 */
export function useChartInk(): string {
    return useColors().foreground;
}
