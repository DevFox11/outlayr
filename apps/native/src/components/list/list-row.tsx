import { Host, Text as NativeText, Picker } from "@expo/ui/swift-ui";
import { pickerStyle, tag, tint } from "@expo/ui/swift-ui/modifiers";
import ArrowRight01Icon from "@hugeicons-pro/core-stroke-rounded/ArrowRight01Icon";
import Tick02Icon from "@hugeicons-pro/core-stroke-rounded/Tick02Icon";
import { HugeiconsIcon } from "@hugeicons/react-native";
import type { ReactNode } from "react";
import { Pressable, Switch, View } from "react-native";

import { MonoLabel } from "@/components/mono-label";
import type { SettingsIconName } from "@/components/settings/settings-icons";
import { settingsIcon } from "@/components/settings/settings-icons";
import { TintedLabel, tintedLabelAvailable } from "@/components/settings/tinted-label";
import { Text } from "@/components/text";
import { cn } from "@/components/tw";
import { useColors } from "@/theme/use-colors";

const GLYPH = 20;

const TITLE_INSET = "pl-8";

export function SettingsSection({ title, footer, children }: { title: string; footer?: string; children?: ReactNode }) {
    return (
        <View className="pt-6">
            <View className="pb-1.5">
                <MonoLabel accessibilityRole="header">{title}</MonoLabel>
            </View>
            <View className="border-border border-t">{children}</View>
            {footer ? <Text className="text-muted text-subtitle pt-2 leading-snug">{footer}</Text> : null}
        </View>
    );
}

interface RowShellProps {
    children?: ReactNode;
    destructive?: boolean;
    detail?: string;
    icon?: SettingsIconName;
    title: string;
}

function RowShell({ icon, title, destructive, detail, children }: RowShellProps) {
    const colors = useColors();
    return (
        <View className="border-border border-b py-3.5">
            <View className="flex-row items-center gap-3">
                {icon ? (
                    <HugeiconsIcon
                        color={destructive ? colors.danger : colors.foreground}
                        icon={settingsIcon(icon)}
                        size={GLYPH}
                        strokeWidth={1.9}
                    />
                ) : null}
                <Text
                    className={cn("text-body flex-1", destructive ? "text-danger" : "text-foreground")}
                    numberOfLines={1}
                >
                    {title}
                </Text>
                {children}
            </View>
            {detail ? (
                <Text className={cn(icon && TITLE_INSET, "text-muted text-subtitle leading-snug")}>{detail}</Text>
            ) : null}
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
            <HugeiconsIcon color={colors.subtle} icon={ArrowRight01Icon} size={16} strokeWidth={2.2} />
        </View>
    );
}

function RowTrailing({ interactive, value }: { interactive: boolean; value?: string }) {
    if (interactive) {
        return <Disclosure value={value} />;
    }
    if (value) {
        return <Text className="text-body text-muted">{value}</Text>;
    }
    return null;
}

interface LinkRowProps {
    destructive?: boolean;
    detail?: string;
    icon?: SettingsIconName;
    onPress?: () => void;
    title: string;
    value?: string;
}

export function LinkRow({ icon, title, value, detail, destructive, onPress }: LinkRowProps) {
    const body = (
        <RowShell destructive={destructive} detail={detail} icon={icon} title={title}>
            <RowTrailing interactive={onPress != null} value={value} />
        </RowShell>
    );

    if (!onPress) {
        return body;
    }

    return (
        <Pressable accessibilityRole="button" className="active:opacity-60" onPress={onPress}>
            {body}
        </Pressable>
    );
}

export function PickerRow<T extends string | number | boolean>({
    attention = false,
    icon,
    title,
    detail,
    options,
    value,
    onChange,
}: {
    attention?: boolean;
    icon: SettingsIconName;
    title: string;
    detail?: string;
    options: readonly { label: string; swatch?: string; value: T }[];
    value: T;
    onChange: (value: T) => void;
}) {
    const colors = useColors();
    return (
        <RowShell detail={detail} icon={icon} title={title}>
            <Host matchContents>
                <Picker
                    modifiers={[pickerStyle("menu"), tint(attention ? colors.danger : colors.muted)]}
                    onSelectionChange={(next) => {
                        const picked = options.find((option) => String(option.value) === next);
                        if (picked) {
                            onChange(picked.value);
                        }
                    }}
                    selection={String(value)}
                >
                    {options.map((option) => {
                        const key = String(option.value);
                        if (tintedLabelAvailable && option.swatch) {
                            return (
                                <TintedLabel
                                    color={option.swatch}
                                    key={key}
                                    modifiers={[tag(key)]}
                                    title={option.label}
                                />
                            );
                        }
                        return (
                            <NativeText key={key} modifiers={[tag(key)]}>
                                {option.label}
                            </NativeText>
                        );
                    })}
                </Picker>
            </Host>
        </RowShell>
    );
}

export function ToggleRow({
    icon,
    title,
    value,
    onValueChange,
    testID,
}: {
    icon: SettingsIconName;
    title: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
    testID?: string;
}) {
    const colors = useColors();
    return (
        <RowShell icon={icon} title={title}>
            <Switch
                accessibilityLabel={title}
                onValueChange={onValueChange}
                testID={testID}
                trackColor={{ false: colors.subtle, true: colors.tint }}
                value={value}
            />
        </RowShell>
    );
}

export function ChoiceRow({
    label,
    detail,
    leading,
    selected,
    onPress,
}: {
    label: string;
    detail?: string;
    leading?: ReactNode;
    selected: boolean;
    onPress: () => void;
}) {
    const colors = useColors();
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className="border-border flex-row items-center gap-3 border-b py-3.5 active:opacity-60"
            onPress={onPress}
        >
            {leading}
            <View className="flex-1 gap-0.5">
                <Text className="text-body text-foreground">{label}</Text>
                {detail ? <Text className="text-muted text-subtitle leading-snug">{detail}</Text> : null}
            </View>
            {selected ? <HugeiconsIcon color={colors.tint} icon={Tick02Icon} size={20} strokeWidth={2.4} /> : null}
        </Pressable>
    );
}
