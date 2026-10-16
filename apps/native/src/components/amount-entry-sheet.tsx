import { BottomSheetModal, BottomSheetView } from "@expo/ui/community/bottom-sheet";
import { SymbolView } from "expo-symbols";
import type { Ref } from "react";
import { Pressable, View } from "react-native";

import { currencySymbol } from "@/domain/money";
import { useTranslation } from "@/i18n/context";
import { useColors } from "@/theme/use-colors";

import { AmountNumpad } from "./amount-numpad";
import { GlassButton } from "./glass-button";
import { SheetGestureRoot } from "./sheet-gesture-root";
import { Text } from "./text";

/** Sized by its content: the sheet fits to it, so the root must not take `flex: 1`. */
const FIT_CONTENT = { alignSelf: "stretch" } as const;

interface AmountEntrySheetProps {
    code: string;
    minorUnits: number;
    onChange: (next: string) => void;
    onDone: () => void;
    ref?: Ref<BottomSheetModal>;
    toneClass?: string;
    value: string;
}

export function AmountEntrySheet({ value, minorUnits, code, toneClass, onChange, onDone, ref }: AmountEntrySheetProps) {
    const colors = useColors();
    const t = useTranslation();
    const symbol = currencySymbol(code);

    return (
        <BottomSheetModal
            backgroundStyle={{ backgroundColor: colors.background }}
            enableDynamicSizing
            enablePanDownToClose
            ref={ref}
        >
            <BottomSheetView style={{ paddingBottom: 8 }}>
                <SheetGestureRoot style={FIT_CONTENT}>
                    <View className="flex-row items-center justify-between px-4 pt-2 pb-1">
                        <Text className="font-sans-semibold text-body text-muted px-[15px]">{`${code} (${symbol})`}</Text>

                        <GlassButton
                            accessibilityLabel={t("common.close")}
                            className="size-11 rounded-[22px]"
                            onPress={onDone}
                        >
                            <SymbolView
                                name="xmark"
                                size={18}
                                tintColor={colors.muted}
                                type="monochrome"
                                weight="semibold"
                            />
                        </GlassButton>
                    </View>

                    <View className="px-4">
                        <AmountNumpad
                            code={code}
                            minorUnits={minorUnits}
                            onChange={onChange}
                            toneClass={toneClass}
                            value={value}
                        />
                    </View>

                    <View className="px-4 pt-6">
                        <Pressable
                            accessibilityRole="button"
                            className="bg-foreground h-14 items-center justify-center rounded-[28px] active:opacity-70"
                            onPress={onDone}
                        >
                            <Text className="font-sans-semibold text-background text-callout">{t("common.done")}</Text>
                        </Pressable>
                    </View>
                </SheetGestureRoot>
            </BottomSheetView>
        </BottomSheetModal>
    );
}
