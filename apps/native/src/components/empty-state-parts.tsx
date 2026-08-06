import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Svg, { Rect } from "react-native-svg";

import { useMark } from "./empty-state";

interface BarProps {
	width: number;
	height?: number;
	opacity?: number;
}

export function Bar({ width, height = 8, opacity }: BarProps) {
	const ink = useMark();
	return (
		<View
			style={{
				width,
				height,
				borderRadius: height / 2,
				backgroundColor: ink.fill,
				opacity,
			}}
		/>
	);
}

export function Hairline({ opacity }: { opacity?: number }) {
	const ink = useMark();
	return (
		<View
			style={{ height: 1, width: "100%", backgroundColor: ink.rule, opacity }}
		/>
	);
}

interface SlotProps {
	width: number;
	height: number;
	radius?: number;
	children?: ReactNode;
	style?: ViewStyle;
}

export function Slot({
	width,
	height,
	radius = 10,
	children,
	style,
}: SlotProps) {
	const ink = useMark();
	const inset = 0.75;
	return (
		<View style={[{ width, height }, style]}>
			<Svg
				height={height}
				style={StyleSheet.absoluteFill}
				viewBox={`0 0 ${width} ${height}`}
				width={width}
			>
				<Rect
					fill="none"
					height={height - inset * 2}
					rx={radius}
					stroke={ink.edge}
					strokeDasharray="5 5"
					strokeWidth={1.5}
					width={width - inset * 2}
					x={inset}
					y={inset}
				/>
			</Svg>
			{children}
		</View>
	);
}

export function Tile({
	size,
	radius,
	opacity,
	children,
}: {
	size: number;
	radius?: number;
	opacity?: number;
	children?: ReactNode;
}) {
	const ink = useMark();
	return (
		<View
			style={{
				width: size,
				height: size,
				borderRadius: radius ?? size * 0.24,
				borderCurve: "continuous",
				backgroundColor: ink.fill,
				opacity,
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			{children}
		</View>
	);
}

export function GhostAvatar({ size = 30 }: { size?: number }) {
	const ink = useMark();
	return (
		<View
			style={{
				width: size,
				height: size,
				borderRadius: size / 2,
				backgroundColor: ink.fill,
			}}
		/>
	);
}

export function GhostPanel({
	width,
	children,
	style,
}: {
	width: number;
	children?: ReactNode;
	style?: ViewStyle;
}) {
	const ink = useMark();
	return (
		<View
			style={[
				{
					width,
					backgroundColor: ink.wash,
					borderWidth: 1.5,
					borderColor: ink.edge,
					borderRadius: 20,
					borderCurve: "continuous",
				},
				style,
			]}
		>
			{children}
		</View>
	);
}

interface GhostRowProps {
	noteWidth: number;
	subWidth?: number;
	amountWidth?: number;
	opacity?: number;
	avatarSize?: number;
	scale?: number;
}

export function GhostRow({
	noteWidth,
	subWidth,
	amountWidth,
	opacity,
	avatarSize = 30,
	scale = 1,
}: GhostRowProps) {
	return (
		<View
			className="flex-row items-center"
			style={{ paddingVertical: 8 * scale, opacity }}
		>
			<GhostAvatar size={avatarSize} />
			<View style={{ marginLeft: 10 * scale, gap: 5 * scale }}>
				<Bar height={8 * scale} width={noteWidth} />
				{subWidth ? <Bar height={6 * scale} width={subWidth} /> : null}
			</View>
			<View style={{ flex: 1 }} />
			{amountWidth ? <Bar height={9 * scale} width={amountWidth} /> : null}
		</View>
	);
}
