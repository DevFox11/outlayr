import { HugeiconsIcon } from "@hugeicons/react-native";
import {
	ArrowRight01Icon,
	Tick02Icon,
} from "@hugeicons-pro/core-stroke-rounded";
import type { ReactNode } from "react";
import { Pressable, Switch, View } from "react-native";
import { MonoLabel } from "@/components/mono-label";
import { Text } from "@/components/text";
import { cn } from "@/components/tw";
import { useColors } from "@/theme/use-colors";
import type { SettingsIconName } from "./settings-icons";
import { settingsIcon } from "./settings-icons";

const GLYPH = 20;

export function SettingsSection({
	title,
	footer,
	children,
}: {
	title: string;
	footer?: string;
	children: ReactNode;
}) {
	return (
		<View className="pt-6">
			<View className="pb-1.5">
				<MonoLabel>{title}</MonoLabel>
			</View>
			<View className="border-border border-t">{children}</View>
			{footer ? (
				<Text className="pt-2 text-muted text-subtitle leading-snug">
					{footer}
				</Text>
			) : null}
		</View>
	);
}

interface RowShellProps {
	icon: SettingsIconName;
	title: string;
	destructive?: boolean;
	children?: ReactNode;
}

function RowShell({ icon, title, destructive, children }: RowShellProps) {
	const colors = useColors();
	return (
		<View className="flex-row items-center gap-3 border-border border-b py-3.5">
			<HugeiconsIcon
				color={destructive ? colors.danger : colors.foreground}
				icon={settingsIcon(icon)}
				size={GLYPH}
				strokeWidth={1.9}
			/>
			<Text
				className={cn(
					"flex-1 text-body",
					destructive ? "text-danger" : "text-foreground",
				)}
				numberOfLines={1}
			>
				{title}
			</Text>
			{children}
		</View>
	);
}

function Disclosure({ value }: { value?: string }) {
	const colors = useColors();
	return (
		<View className="flex-row items-center gap-1.5">
			{value ? (
				<Text className="text-body text-muted" numberOfLines={1}>
					{value}
				</Text>
			) : null}
			<HugeiconsIcon
				color={colors.subtle}
				icon={ArrowRight01Icon}
				size={16}
				strokeWidth={2.2}
			/>
		</View>
	);
}

interface LinkRowProps {
	icon: SettingsIconName;
	title: string;
	/** Trailing detail — the current currency code, "Off", a count. */
	value?: string;
	destructive?: boolean;
	/**
	 * Tap handler. Omitted renders the row inert with no chevron — used for
	 * unavailable features (e.g. Sync before an account exists).
	 */
	onPress?: () => void;
}

export function LinkRow({
	icon,
	title,
	value,
	destructive,
	onPress,
}: LinkRowProps) {
	const body = (
		<RowShell destructive={destructive} icon={icon} title={title}>
			{onPress ? (
				<Disclosure value={value} />
			) : value ? (
				<Text className="text-body text-muted">{value}</Text>
			) : null}
		</RowShell>
	);

	if (!onPress) {
		return body;
	}

	return (
		<Pressable
			accessibilityRole="button"
			className="active:opacity-60"
			onPress={onPress}
		>
			{body}
		</Pressable>
	);
}

export function ToggleRow({
	icon,
	title,
	value,
	onValueChange,
}: {
	icon: SettingsIconName;
	title: string;
	value: boolean;
	onValueChange: (value: boolean) => void;
}) {
	const colors = useColors();
	return (
		<RowShell icon={icon} title={title}>
			<Switch
				accessibilityLabel={title}
				onValueChange={onValueChange}
				trackColor={{ true: colors.income, false: colors.subtle }}
				value={value}
			/>
		</RowShell>
	);
}

/**
 * One option on a choice screen. Settings picks with these rather than an inline
 * `MenuView`, whose intrinsic width lands a frame late on iOS — see `ScopeChip`.
 */
export function ChoiceRow({
	label,
	detail,
	selected,
	onPress,
}: {
	label: string;
	detail?: string;
	selected: boolean;
	onPress: () => void;
}) {
	const colors = useColors();
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ selected }}
			className="flex-row items-center gap-3 border-border border-b py-3.5 active:opacity-60"
			onPress={onPress}
		>
			<View className="flex-1 gap-0.5">
				<Text className="text-body text-foreground">{label}</Text>
				{detail ? (
					<Text className="text-muted text-subtitle leading-snug">
						{detail}
					</Text>
				) : null}
			</View>
			{selected ? (
				<HugeiconsIcon
					color={colors.tint}
					icon={Tick02Icon}
					size={20}
					strokeWidth={2.4}
				/>
			) : null}
		</Pressable>
	);
}
