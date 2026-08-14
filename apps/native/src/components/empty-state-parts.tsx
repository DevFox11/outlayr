import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { ViewStyle } from "react-native";
import Svg, { Rect } from "react-native-svg";

import { useMark } from "./empty-state";

interface BarProps {
    height?: number;
    opacity?: number;
    width: number;
}

export function Bar({ width, height = 8, opacity }: BarProps) {
    const ink = useMark();
    return (
        <View
            style={{
                backgroundColor: ink.fill,
                borderRadius: height / 2,
                height,
                opacity,
                width,
            }}
        />
    );
}

export function Hairline({ opacity }: { opacity?: number }) {
    const ink = useMark();
    return <View style={{ backgroundColor: ink.rule, height: 1, opacity, width: "100%" }} />;
}

interface SlotProps {
    children?: ReactNode;
    height: number;
    radius?: number;
    style?: ViewStyle;
    width: number;
}

export function Slot({ width, height, radius = 10, children, style }: SlotProps) {
    const ink = useMark();
    const inset = 0.75;
    return (
        <View style={[{ height, width }, style]}>
            <Svg height={height} style={StyleSheet.absoluteFill} viewBox={`0 0 ${width} ${height}`} width={width}>
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
                alignItems: "center",
                backgroundColor: ink.fill,
                borderCurve: "continuous",
                borderRadius: radius ?? size * 0.24,
                height: size,
                justifyContent: "center",
                opacity,
                width: size,
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
                backgroundColor: ink.fill,
                borderRadius: size / 2,
                height: size,
                width: size,
            }}
        />
    );
}

export function GhostPanel({ width, children, style }: { width: number; children?: ReactNode; style?: ViewStyle }) {
    const ink = useMark();
    return (
        <View
            style={[
                {
                    backgroundColor: ink.wash,
                    borderColor: ink.edge,
                    borderCurve: "continuous",
                    borderRadius: 20,
                    borderWidth: 1.5,
                    width,
                },
                style,
            ]}
        >
            {children}
        </View>
    );
}

interface GhostRowProps {
    amountWidth?: number;
    avatarSize?: number;
    noteWidth: number;
    opacity?: number;
    scale?: number;
    subWidth?: number;
}

export function GhostRow({ noteWidth, subWidth, amountWidth, opacity, avatarSize = 30, scale = 1 }: GhostRowProps) {
    return (
        <View className="flex-row items-center" style={{ opacity, paddingVertical: 8 * scale }}>
            <GhostAvatar size={avatarSize} />
            <View style={{ gap: 5 * scale, marginLeft: 10 * scale }}>
                <Bar height={8 * scale} width={noteWidth} />
                {subWidth ? <Bar height={6 * scale} width={subWidth} /> : null}
            </View>
            <View style={{ flex: 1 }} />
            {amountWidth ? <Bar height={9 * scale} width={amountWidth} /> : null}
        </View>
    );
}
