import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { SymbolView } from "expo-symbols";
import { NumberFlow } from "number-flow-react-native";
import { useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { useSettingNumber } from "@/contexts/display-settings-context";
import { currencySymbol, numberLocale } from "@/domain/money";
import { applyNumpadKey, numpadMode, numpadToNumber } from "@/domain/numpad";
import type { NumpadKey, NumpadMode, NumpadTileKey } from "@/domain/numpad";
import { useLanguage, useTranslation } from "@/i18n/context";
import { useHaptics } from "@/lib/use-haptics";
import { useColors } from "@/theme/use-colors";

import { Text } from "./text";

const GLASS = isLiquidGlassAvailable();

const ROWS: NumpadTileKey[][] = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    [".", "0", "back"],
];

interface AmountNumpadProps {
    code: string;
    minorUnits: number;
    /**
     * Overrides `numberEntryType`. For a field that is not money — an exchange
     * rate — where "the last two digits are cents" describes nothing the user
     * is typing, so the money preference must not reach it.
     */
    mode?: NumpadMode;
    onChange: (next: string) => void;
    /** Off where the caller already shows the figure above the keys. */
    showDisplay?: boolean;
    toneClass?: string;
    value: string;
}

export function AmountNumpad({
    value,
    minorUnits,
    code,
    toneClass,
    mode: modeOverride,
    onChange,
    showDisplay = true,
}: AmountNumpadProps) {
    const colors = useColors();
    const haptics = useHaptics();
    const t = useTranslation();
    const { language } = useLanguage();
    const preference = useSettingNumber("numberEntryType");
    const mode = modeOverride ?? numpadMode(preference);
    const locale = numberLocale(language);
    const symbol = currencySymbol(code);
    const amountColor = toneClass?.includes("income") ? colors.income : colors.foreground;

    /**
     * What the last press produced, and the `value` it was built from. `value`
     * is a render-time prop, so two presses landing inside one commit window
     * would both read the string from before the first of them and the earlier
     * keystroke would be lost — a dropped digit is a tenfold error under
     * `preDotted`. Keyed on the base rather than cleared on a timer so it stops
     * applying the moment a render catches up. Every caller stores what it is
     * handed verbatim; one that declined a keystroke would need to say so.
     */
    const chained = useRef<{ base: string; next: string } | null>(null);

    const press = (key: NumpadKey) => {
        // A long press has no tell of its own beyond the amount resetting, and
        // `keyTap` is silent below the excessive haptics level.
        haptics(key === "clear" ? "medium" : "keyTap");
        const current = chained.current?.base === value ? chained.current.next : value;
        const next = applyNumpadKey(current, key, minorUnits, mode);
        chained.current = { base: value, next };
        onChange(next);
    };

    return (
        // No horizontal inset of its own: the caller owns it, so the keys line up
        // with whatever sits under them — the sheet's Done button at `px-4`, the
        // first-run CTA at `px-6`.
        <View>
            {showDisplay ? (
                <>
                    <View className="items-center pt-2">
                        <Text className="text-body text-muted font-sans">{t("transaction.field.amount")}</Text>
                    </View>
                    <View className="min-h-14 items-center justify-center px-4 pt-2 pb-7">
                        <NumberFlow
                            format={{
                                maximumFractionDigits: minorUnits,
                                minimumFractionDigits: minorUnits,
                                useGrouping: true,
                            }}
                            locales={locale.tag}
                            prefix={locale.placement === "prefix" ? `${symbol} ` : undefined}
                            style={{
                                color: amountColor,
                                fontFamily: "SFProRounded-Medium",
                                fontSize: 40,
                            }}
                            suffix={locale.placement === "suffix" ? ` ${symbol}` : undefined}
                            value={numpadToNumber(value)}
                        />
                    </View>
                </>
            ) : null}
            <View className="gap-[9px]">
                {ROWS.map((row) => (
                    <View className="flex-row gap-[9px]" key={row.join(",")}>
                        {row.map((key) => (
                            <NumpadKeyTile
                                fg={colors.foreground}
                                glyph={key === "." ? locale.decimal : key}
                                hidden={key === "." && (minorUnits === 0 || mode === "preDotted")}
                                key={key}
                                label={key}
                                onLongPress={key === "back" ? () => press("clear") : undefined}
                                onPress={() => press(key)}
                            />
                        ))}
                    </View>
                ))}
            </View>
        </View>
    );
}

function NumpadKeyTile({
    label,
    glyph,
    hidden,
    fg,
    onPress,
    onLongPress,
}: {
    label: NumpadTileKey;
    /** The separator key draws the active language's mark, not the canonical ".". */
    glyph: string;
    hidden: boolean;
    fg: string;
    onPress: () => void;
    onLongPress?: () => void;
}) {
    const t = useTranslation();
    if (hidden) {
        return <View className="h-16 flex-1" />;
    }
    return (
        <Pressable
            accessibilityLabel={label === "back" ? t("transaction.numpad.delete") : glyph}
            accessibilityRole="button"
            className="h-16 flex-1 items-center justify-center overflow-hidden rounded-2xl active:scale-[0.96] active:opacity-65"
            onLongPress={onLongPress}
            onPress={onPress}
        >
            {GLASS ? (
                <GlassView glassEffectStyle="regular" style={StyleSheet.absoluteFill} />
            ) : (
                <View className="bg-surface absolute inset-0" />
            )}
            {label === "back" ? (
                <SymbolView name="delete.left" size={26} tintColor={fg} type="monochrome" weight="medium" />
            ) : (
                <Text className="font-sans-medium text-foreground text-[30px]">{glyph}</Text>
            )}
        </Pressable>
    );
}
