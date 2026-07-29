import { View } from "react-native";
import Svg, {
	Circle,
	ClipPath,
	Defs,
	G,
	Line,
	Path,
	Rect,
} from "react-native-svg";

import { Text } from "@/components/text";
import { withAlpha } from "@/theme/shade";
import { useColors } from "@/theme/use-colors";

interface SearchEmptyStateProps {
	kind: "idle" | "noResults";
	query?: string;
}

export function SearchEmptyState({ kind, query }: SearchEmptyStateProps) {
	const idle = kind === "idle";
	return (
		<View className="items-center gap-3.5 px-8 pt-20">
			<View className="pb-1.5">
				{idle ? <SearchIdleMark /> : <SearchNoResultsMark />}
			</View>
			<Text className="text-center font-sans-semibold text-foreground text-title">
				{idle ? "Search your ledger" : "No matches"}
			</Text>
			<Text className="max-w-70 text-center font-sans-medium text-muted text-subtitle">
				{idle
					? "Find an entry by its note, category, or amount."
					: `No entry matches “${query ?? ""}”.`}
			</Text>
		</View>
	);
}

const IDLE_SIDE = 120;

/** A magnifier over a ledger page, one row showing through the glass. */
function SearchIdleMark() {
	const colors = useColors();
	const rule = colors.border;
	const ink = colors.foreground;
	const w = IDLE_SIDE;
	const h = IDLE_SIDE;

	const cx = w * 0.42;
	const cy = h * 0.4;
	const r = w * 0.34;

	const rowCount = 5;
	const rowTop = cy - r * 0.78;
	const rowGap = (r * 1.56) / (rowCount - 1);
	const gutterX = cx - r * 0.3;
	const midY = rowTop + rowGap * 2;
	// cos(45°): where the handle meets the rim.
	const diagonal = Math.SQRT1_2;

	return (
		<Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
			<Defs>
				<ClipPath id="lens">
					<Circle cx={cx} cy={cy} r={r} />
				</ClipPath>
			</Defs>

			<Circle cx={cx} cy={cy} r={r} fill={withAlpha(ink, 0.04)} />

			<G clipPath="url(#lens)">
				{Array.from({ length: rowCount }, (_, index) => {
					const y = rowTop + rowGap * index;
					return (
						<Line
							key={y}
							x1={cx - r}
							y1={y}
							x2={cx + r}
							y2={y}
							stroke={rule}
							strokeWidth={1}
						/>
					);
				})}
				<Line
					x1={gutterX}
					y1={cy - r}
					x2={gutterX}
					y2={cy + r}
					stroke={rule}
					strokeWidth={1}
				/>
				<Line
					x1={gutterX + r * 0.14}
					y1={midY}
					x2={cx + r * 0.68}
					y2={midY}
					stroke={withAlpha(ink, 0.42)}
					strokeWidth={2}
					strokeLinecap="round"
				/>
			</G>

			<Circle
				cx={cx}
				cy={cy}
				r={r}
				stroke={ink}
				strokeWidth={2.5}
				fill="none"
			/>
			<Line
				x1={cx + diagonal * r}
				y1={cy + diagonal * r}
				x2={w * 0.91}
				y2={h * 0.91}
				stroke={ink}
				strokeWidth={3.5}
				strokeLinecap="round"
			/>
		</Svg>
	);
}

const NO_RESULTS_SIDE = 96;

/** The same ledger page with a single diagonal strike through it. */
function SearchNoResultsMark() {
	const colors = useColors();
	const rule = colors.border;
	const ink = colors.foreground;
	const side = NO_RESULTS_SIDE;
	const inset = 0.5;
	const pageSide = side - inset * 2;

	const rowCount = 4;
	const top = inset + pageSide * 0.26;
	const spacing = (side - inset - top) / rowCount;
	const gutter = inset + pageSide * 0.28;
	const pad = pageSide * 0.1;

	return (
		<Svg width={side} height={side} viewBox={`0 0 ${side} ${side}`}>
			<Rect
				x={inset}
				y={inset}
				width={pageSide}
				height={pageSide}
				rx={side * 0.09}
				stroke={rule}
				strokeWidth={1}
				fill="none"
			/>
			{Array.from({ length: rowCount }, (_, index) => {
				const y = top + spacing * index;
				return (
					<Line
						key={y}
						x1={inset}
						y1={y}
						x2={side - inset}
						y2={y}
						stroke={rule}
						strokeWidth={1}
					/>
				);
			})}
			<Line
				x1={gutter}
				y1={top}
				x2={gutter}
				y2={side - inset}
				stroke={rule}
				strokeWidth={1}
			/>
			<Path
				d={`M${inset + pad} ${inset + pad} L${side - inset - pad} ${
					side - inset - pad
				}`}
				stroke={ink}
				strokeWidth={2.5}
				strokeLinecap="round"
			/>
		</Svg>
	);
}
