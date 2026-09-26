import type { EntryRateType } from "@outlayr/money/rates";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { currencySymbol } from "@/domain/money";

import { FlowAmount } from "../../amount-text";
import { Text } from "../../text";
import { cn } from "../../tw";

export interface StepRateOption {
    detail: string;
    figure: string | null;
    name: string;
    placeholder: string;
    type: EntryRateType;
    unit: string;
}

interface StepRateProps {
    onSelect: (type: EntryRateType) => void;
    options: readonly StepRateOption[];
    selected: EntryRateType;
}

export function StepRate({ onSelect, options, selected }: StepRateProps) {
    return (
        <View className="border-separator border-t">
            {options.map((option) => {
                const checked = option.type === selected;
                return (
                    <Pressable
                        accessibilityLabel={option.name}
                        accessibilityRole="radio"
                        accessibilityState={{ checked }}
                        accessibilityValue={{
                            text: option.figure === null ? option.placeholder : `${option.figure} ${option.unit}`,
                        }}
                        className="border-separator flex-row items-center gap-3 border-b py-2.5 active:opacity-60"
                        key={option.type}
                        onPress={() => onSelect(option.type)}
                        style={{ minHeight: 56 }}
                    >
                        <View
                            className={cn(
                                "h-[22px] w-[22px] items-center justify-center rounded-full border-2",
                                checked ? "border-tint" : "border-muted"
                            )}
                        >
                            {checked ? <View className="bg-tint h-2.5 w-2.5 rounded-full" /> : null}
                        </View>
                        <View className="min-w-0 flex-1">
                            <Text className="font-sans-semibold text-callout text-foreground">{option.name}</Text>
                            <Text className="text-footnote text-muted" numberOfLines={1}>
                                {option.detail}
                            </Text>
                        </View>
                        <View className="items-end">
                            <Text
                                className={cn(
                                    "font-mono-medium text-title tabular-nums",
                                    option.figure === null ? "text-muted" : "text-foreground"
                                )}
                            >
                                {option.figure ?? option.placeholder}
                            </Text>
                            <Text className="text-footnote text-muted">{option.unit}</Text>
                        </View>
                    </Pressable>
                );
            })}
        </View>
    );
}

export interface StepRateReference {
    figure: string;
    label: string;
    onPress: () => void;
}

interface StepRateFieldProps {
    children: ReactNode;
    error: string | null;
    figure?: { amount: number; code: string };
    note: string | null;
    placeholder: boolean;
    references?: readonly StepRateReference[];
    unit?: string;
    value: string;
}

export function StepRateField({
    children,
    error,
    figure,
    note,
    placeholder,
    references,
    unit,
    value,
}: StepRateFieldProps) {
    const valueClass = cn(
        "font-mono-medium text-[34px] leading-[42px] tracking-tight tabular-nums",
        placeholder ? "text-muted" : "text-foreground"
    );
    return (
        <View className="gap-2">
            <View accessibilityLiveRegion="polite" className="flex-row items-baseline gap-2">
                <View className="flex-row items-center">
                    {figure !== undefined && !placeholder ? (
                        <FlowAmount
                            amount={figure.amount}
                            className={valueClass}
                            code={figure.code}
                            prefix={currencySymbol(figure.code)}
                            showCents
                        />
                    ) : (
                        <Text className={valueClass}>{value}</Text>
                    )}
                    <View className="bg-tint ml-0.5 h-[30px] w-[2.5px] rounded-full" />
                </View>
                {unit === undefined ? null : <Text className="text-callout text-foreground">{unit}</Text>}
            </View>
            {error === null ? null : <Text className="text-danger text-subtitle">{error}</Text>}
            {note === null ? null : <Text className="text-subtitle text-foreground">{note}</Text>}
            {references === undefined || references.length === 0 ? null : (
                <View className="border-separator mb-1 flex-row border-t">
                    {references.map((reference, index) => (
                        <Pressable
                            accessibilityLabel={reference.label}
                            accessibilityRole="button"
                            accessibilityValue={{ text: reference.figure }}
                            className={cn(
                                "min-w-0 flex-1 pt-2 active:opacity-60",
                                index > 0 && "border-separator border-l pl-3.5"
                            )}
                            key={reference.label}
                            onPress={reference.onPress}
                            style={{ minHeight: 44 }}
                        >
                            <Text className="text-subtitle text-foreground">{reference.label}</Text>
                            <Text className="font-mono-medium text-callout text-foreground tabular-nums">
                                {reference.figure}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            )}
            {children}
        </View>
    );
}
