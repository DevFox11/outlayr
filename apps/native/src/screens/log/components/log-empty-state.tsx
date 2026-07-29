import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Text } from "@/components/text";
import { useTranslation } from "@/i18n";
import { withAlpha } from "@/theme/shade";

const GHOST = "#767676";
const CARD_FILL = withAlpha(GHOST, 0.05);
const CARD_STROKE = withAlpha(GHOST, 0.22);
const SOFT_FILL = withAlpha(GHOST, 0.13);

const CARD_WIDTH = 244;
const CARD_HEIGHT = 200;

export function LogEmptyState() {
	const t = useTranslation();
	return (
		// A View, not a ScrollView: react-native-screens gives the first descendant
		// scroll view a top content inset so the large title can hook to it, and
		// that inset offsets the container's origin while it still measures a full
		// screen tall — centring inside it lands the card in the lower half.
		<View className="flex-1 items-center justify-center bg-background">
			<GhostCard />
			<View className="items-center pt-7">
				<Text className="pb-1.5 font-sans-semibold text-foreground text-title">
					{t("log.empty.title")}
				</Text>
				<Text className="max-w-70 text-center font-sans-medium text-muted text-subtitle">
					{t("log.empty.body")}
				</Text>
			</View>
		</View>
	);
}

function GhostCard() {
	return (
		<View
			style={{
				width: CARD_WIDTH,
				height: CARD_HEIGHT,
				borderRadius: 22,
				backgroundColor: CARD_FILL,
				borderWidth: 1.5,
				borderColor: CARD_STROKE,
				justifyContent: "center",
				shadowColor: "#000000",
				shadowOpacity: 0.04,
				shadowRadius: 12,
				shadowOffset: { width: 0, height: 5 },
			}}
		>
			<View style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
				<View
					className="flex-row items-center justify-between"
					style={{ paddingVertical: 11 }}
				>
					<Bar width={72} height={8} />
					<Bar width={44} height={8} />
				</View>
				<Divider opacity={1} />
				<GhostRow noteWidth={108} subWidth={60} amountWidth={56} opacity={1} />
				<Divider opacity={0.7} />
				<GhostRow
					noteWidth={82}
					subWidth={50}
					amountWidth={48}
					opacity={0.55}
				/>
				<Divider opacity={0.4} />
				<GhostRow
					noteWidth={96}
					subWidth={44}
					amountWidth={62}
					opacity={0.28}
				/>
			</View>

			<SparkleAt size={12} offsetX={-112} offsetY={-80} />
			<SparkleAt size={8} offsetX={112} offsetY={-54} />
			<SparkleAt size={9} offsetX={100} offsetY={78} />
		</View>
	);
}

function Bar({
	width,
	height,
	opacity = 1,
}: {
	width: number;
	height: number;
	opacity?: number;
}) {
	return (
		<View
			style={{
				width,
				height,
				borderRadius: height / 2,
				backgroundColor: SOFT_FILL,
				opacity,
			}}
		/>
	);
}

function Divider({ opacity }: { opacity: number }) {
	return (
		<View
			style={{ height: 1, backgroundColor: withAlpha(GHOST, 0.28 * opacity) }}
		/>
	);
}

function GhostRow({
	noteWidth,
	subWidth,
	amountWidth,
	opacity,
}: {
	noteWidth: number;
	subWidth: number;
	amountWidth: number;
	opacity: number;
}) {
	return (
		<View
			className="flex-row items-center"
			style={{ paddingVertical: 9, opacity }}
		>
			<View
				style={{
					width: 34,
					height: 34,
					borderRadius: 17,
					backgroundColor: SOFT_FILL,
				}}
			/>
			<View style={{ marginLeft: 10, gap: 5 }}>
				<Bar width={noteWidth} height={9} />
				<Bar width={subWidth} height={7} />
			</View>
			<View style={{ flex: 1 }} />
			<Bar width={amountWidth} height={11} />
		</View>
	);
}

function SparkleAt({
	size,
	offsetX,
	offsetY,
}: {
	size: number;
	offsetX: number;
	offsetY: number;
}) {
	return (
		<View
			style={{
				position: "absolute",
				left: CARD_WIDTH / 2 + offsetX - size / 2,
				top: CARD_HEIGHT / 2 + offsetY - size / 2,
			}}
		>
			<Sparkle size={size} />
		</View>
	);
}

/** A four-point concave sparkle. */
function Sparkle({ size }: { size: number }) {
	const h = size / 2;
	const inner = size * 0.16;
	const d = `M${h} 0 L${h + inner} ${h - inner} L${size} ${h} L${h + inner} ${
		h + inner
	} L${h} ${size} L${h - inner} ${h + inner} L0 ${h} L${h - inner} ${
		h - inner
	} Z`;
	return (
		<Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
			<Path d={d} fill={GHOST} />
		</Svg>
	);
}
