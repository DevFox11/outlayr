import { createContext, type ReactNode, use, useMemo } from "react";
import { View } from "react-native";

import { type EmptyStateTier, type GhostInk, ghostInk } from "@/theme/empty-state-ink";
import { useColors } from "@/theme/use-colors";
import { MonoLabel } from "./mono-label";
import { Text } from "./text";
import { cn } from "./tw";

const MarkInkContext = createContext<GhostInk | null>(null);

export function useMark(): GhostInk {
	const inherited = use(MarkInkContext);
	const colors = useColors();
	return useMemo(() => inherited ?? ghostInk(colors.foreground, "takeover"), [inherited, colors.foreground]);
}

export function MarkInk({ tier, children }: { tier: EmptyStateTier; children: ReactNode }) {
	const colors = useColors();
	const ink = useMemo(() => ghostInk(colors.foreground, tier), [colors.foreground, tier]);
	return <MarkInkContext.Provider value={ink}>{children}</MarkInkContext.Provider>;
}

interface EmptyStateProps {
	action?: ReactNode;
	body: string;
	className?: string;
	eyebrow?: string;
	mark: ReactNode;
	tier: EmptyStateTier;
	title?: string;
}

export function EmptyState({ tier, mark, body, title, eyebrow, action, className }: EmptyStateProps) {
	return (
		<MarkInk tier={tier}>
			{tier === "takeover" ? (
				<Takeover action={action} body={body} className={className} mark={mark} title={title} />
			) : tier === "inFlow" ? (
				<InFlow body={body} className={className} eyebrow={eyebrow} mark={mark} />
			) : (
				<InsetRow body={body} className={className} mark={mark} />
			)}
		</MarkInk>
	);
}

const LARGE_TITLE_LIFT = -14;

function Takeover({
	mark,
	body,
	title,
	action,
	className,
}: Pick<EmptyStateProps, "mark" | "body" | "title" | "action" | "className">) {
	return (
		<View className={cn("flex-1 items-center justify-center bg-background px-8", className)}>
			<View className="w-full items-center" style={{ transform: [{ translateY: LARGE_TITLE_LIFT }] }}>
				{mark}
				{title ? <Text className="pt-7 pb-1.5 font-sans-semibold text-foreground text-title">{title}</Text> : null}
				<Text className="max-w-70 text-center font-sans-medium text-muted text-subtitle">{body}</Text>
				{action ? <View className="pt-7">{action}</View> : null}
			</View>
		</View>
	);
}

function InFlow({ mark, body, eyebrow, className }: Pick<EmptyStateProps, "mark" | "body" | "eyebrow" | "className">) {
	return (
		<View className={className}>
			<View className="h-px w-full bg-border" />
			<View className="items-center gap-2.5 py-6">
				{eyebrow ? <MonoLabel>{eyebrow}</MonoLabel> : null}
				{mark}
				<Text className="max-w-70 text-center font-sans-medium text-muted text-subtitle">{body}</Text>
			</View>
			<View className="h-px w-full bg-border" />
		</View>
	);
}

function InsetRow({ mark, body, className }: Pick<EmptyStateProps, "mark" | "body" | "className">) {
	return (
		<View className={cn("flex-row items-center gap-3 py-4", className)}>
			{mark}
			<Text className="flex-1 text-muted text-subtitle leading-snug">{body}</Text>
		</View>
	);
}
