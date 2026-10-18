import { GlassContainer, GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { SymbolView } from "expo-symbols";
import { NumberFlow } from "number-flow-react-native";
import { useCallback, useLayoutEffect, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { AccessibilityActionEvent } from "react-native";

import { useSettingNumber } from "@/contexts/display-settings-context";
import { currencySymbol, numberLocale } from "@/domain/money";
import { applyNumpadKey, numpadMode, numpadToNumber } from "@/domain/numpad";
import type { NumpadKey, NumpadMode, NumpadTileKey } from "@/domain/numpad";
import { useLanguage, useTranslation } from "@/i18n/context";
import { useHaptics } from "@/lib/use-haptics";
import { SANS_BY_WEIGHT } from "@/theme/body-fonts";
import { useColors } from "@/theme/use-colors";

import { Text } from "./text";

const GLASS = isLiquidGlassAvailable();

/** `GlassContainer` is third-party, so it takes a style rather than a class —
    the same reason `GlassView` is never wrapped by uniwind (see `styled.ts`). */
const GRID_GAP = { gap: 8 } as const;

const CLEAR_ACTION = "clear";

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
    onChange: (next: string, key: NumpadKey) => void;
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

    const latest = useRef({ value, minorUnits, mode, onChange });
    useLayoutEffect(() => {
        latest.current = { value, minorUnits, mode, onChange };
    });

    const press = useCallback(
        (key: NumpadKey) => {
            const { value: base, minorUnits: units, mode: entryMode, onChange: emit } = latest.current;
            // A long press has no tell of its own beyond the amount resetting, and
            // `keyTap` is silent below the excessive haptics level.
            haptics(key === "clear" ? "medium" : "keyTap");
            const current = chained.current?.base === base ? chained.current.next : base;
            const next = applyNumpadKey(current, key, units, entryMode);
            chained.current = { base, next };
            emit(next, key);
        },
        [haptics]
    );

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
                            prefix={`${symbol} `}
                            style={{
                                color: amountColor,
                                fontFamily: SANS_BY_WEIGHT[500],
                                fontSize: 40,
                                fontWeight: "500",
                            }}
                            value={numpadToNumber(value)}
                        />
                    </View>
                </>
            ) : null}
            {/* Grouped: remounting twelve loose `GlassView`s — which the stage does
                every time it swaps back to this step — leaves most of them without
                an effect, and only the first column and "0" draw. Inside a
                container they attach as one set. `spacing` stays default so they
                do not merge into each other. */}
            <GlassContainer style={GRID_GAP}>
                {ROWS.map((row) => (
                    <View className="flex-row gap-2" key={row.join(",")}>
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
            </GlassContainer>
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
    // Holds the separator's cell open so "0" stays centred under "8" when the
    // entry model has no use for a separator — see `applyNumpadKey`.
    if (hidden) {
        return <View className="min-h-12 flex-1" />;
    }
    return (
        <Pressable
            accessibilityActions={
                onLongPress ? [{ label: t("transaction.numpad.clear"), name: CLEAR_ACTION }] : undefined
            }
            accessibilityLabel={label === "back" ? t("transaction.numpad.delete") : glyph}
            accessibilityRole="button"
            className="min-h-12 flex-1 items-center justify-center overflow-hidden rounded-xl active:scale-[0.96] active:opacity-65"
            onAccessibilityAction={
                onLongPress
                    ? (event: AccessibilityActionEvent) => {
                          if (event.nativeEvent.actionName === CLEAR_ACTION) {
                              onLongPress();
                          }
                      }
                    : undefined
            }
            onLongPress={onLongPress}
            onPress={onPress}
        >
            {GLASS ? (
                <GlassView glassEffectStyle="regular" style={StyleSheet.absoluteFill} />
            ) : (
                <View className="bg-surface absolute inset-0" />
            )}
            {label === "back" ? (
                <SymbolView name="delete.left" size={20} tintColor={fg} type="monochrome" weight="medium" />
            ) : (
                <Text className="font-sans-medium text-foreground text-[23px]">{glyph}</Text>
            )}
        </Pressable>
    );
}
