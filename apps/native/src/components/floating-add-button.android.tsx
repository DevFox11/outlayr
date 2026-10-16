import ArrowDataTransferHorizontalIcon from "@hugeicons-pro/core-stroke-rounded/ArrowDataTransferHorizontalIcon";
import Cancel01Icon from "@hugeicons-pro/core-stroke-rounded/Cancel01Icon";
import FileImportIcon from "@hugeicons-pro/core-stroke-rounded/FileImportIcon";
import Mic01Icon from "@hugeicons-pro/core-stroke-rounded/Mic01Icon";
import PlusSignIcon from "@hugeicons-pro/core-stroke-rounded/PlusSignIcon";
import ReceiptDollarIcon from "@hugeicons-pro/core-stroke-rounded/ReceiptDollarIcon";
import ScanIcon from "@hugeicons-pro/core-stroke-rounded/ScanIcon";
import { HugeiconsIcon } from "@hugeicons/react-native";
import type { IconSvgElement } from "@hugeicons/react-native";
import { router, useFocusEffect } from "expo-router";
import type { Href } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
    FadeIn,
    FadeInDown,
    FadeOut,
    interpolate,
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from "react-native-reanimated";

import { ImportSheet } from "@/components/import-sheet/import-sheet";
import type { ImportSheetHandle } from "@/components/import-sheet/import-sheet";
import { Text } from "@/components/text";
import { useDatabase } from "@/contexts/local-data-context";
import { useAccounts } from "@/data/accounts";
import { useTranslation } from "@/i18n/context";
import { importDraftStore } from "@/lib/import-draft-store";
import { useHaptics } from "@/lib/use-haptics";
import { withAlpha } from "@/theme/shade";
import { useMaterialColors } from "@/theme/use-material-colors";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** M3 FAB: 56dp, 16dp corners, 16dp in from the edge and above the navigation bar. */
const FAB_SIZE = 56;
const FAB_CORNER = 16;
const EDGE = 16;
/** M3 Expressive FAB menu: 56dp pill items 4dp apart, 8dp above the FAB. */
const ITEM_HEIGHT = 56;
const ITEM_GAP = 4;
const MENU_GAP = 8;
const ICON_SIZE = 24;
const ICON_STROKE = 1.8;
/** A `body` label is 24 tall at scale 1, padded 16 above and below. */
const LABEL_LINE = 24;
const ITEM_PADDING_Y = 32;
const SCRIM_ALPHA = 0.32;
const PRESSED_ALPHA = 0.12;
const FAB_ELEVATION = 6;
const ITEM_ELEVATION = 3;
const STAGGER_MS = 30;
const MORPH = { damping: 22, mass: 0.6, stiffness: 320 } as const;

interface AddAction {
    href: Href | null;
    icon: IconSvgElement;
    key: string;
    label: string;
}

/**
 * How many menu items fit between the FAB and the top of the screen's content.
 * Items grow with the text size, and the least-reached-for go first; the
 * transaction always stays.
 */
function fabMenuFit(actionCount: number, room: number, fontScale: number): number {
    const itemHeight = Math.max(ITEM_HEIGHT, LABEL_LINE * fontScale + ITEM_PADDING_Y);
    const space = room - EDGE - FAB_SIZE - MENU_GAP - EDGE;
    const fitting = Math.floor((space + ITEM_GAP) / (itemHeight + ITEM_GAP));
    return Math.min(actionCount, Math.max(1, fitting));
}

/**
 * The Log's add button on Android: an M3 FAB on `primaryContainer` that opens
 * an M3 Expressive FAB menu over a scrim. The FAB morphs into the menu's close
 * button (a `primary` circle, + turning into X) and system back closes the
 * menu first. Same actions, order and routes as the iOS dial.
 */
export function FloatingAddButton() {
    const m3 = useMaterialColors();
    const t = useTranslation();
    const haptics = useHaptics();
    const { fontScale } = useWindowDimensions();
    const [open, setOpen] = useState(false);
    const [room, setRoom] = useState(0);
    const progress = useSharedValue(0);
    const navigating = useRef(false);
    const importSheetRef = useRef<ImportSheetHandle>(null);
    const canTransfer = useAccounts(useDatabase()).length >= 2;

    useFocusEffect(
        useCallback(() => {
            navigating.current = false;
            return () => {
                setOpen(false);
            };
        }, [])
    );

    useEffect(() => {
        progress.set(withSpring(open ? 1 : 0, MORPH));
    }, [open, progress]);

    useEffect(() => {
        if (!open) {
            return;
        }
        const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
            setOpen(false);
            return true;
        });
        return () => subscription.remove();
    }, [open]);

    const toggle = useCallback(
        (next: boolean) => {
            setOpen(next);
            haptics("selection");
        },
        [haptics]
    );

    const select = useCallback(({ href }: AddAction) => {
        setOpen(false);
        if (href === null) {
            importDraftStore.setStep(importDraftStore.getResumeStep());
            importSheetRef.current?.present();
            return;
        }
        if (navigating.current) {
            return;
        }
        navigating.current = true;
        router.push(href);
    }, []);

    // Bottom-up by how often each is reached for: the transaction always, then
    // moving money, speaking, scanning, and a CSV import last.
    const ranked: AddAction[] = [
        { href: "/transactions/create", icon: ReceiptDollarIcon, key: "transaction", label: t("log.add.transaction") },
        ...(canTransfer
            ? [
                  {
                      href: "/transactions/transfers/create" as const,
                      icon: ArrowDataTransferHorizontalIcon,
                      key: "transfer",
                      label: t("log.add.transfer"),
                  },
              ]
            : []),
        { href: "/transactions/voice", icon: Mic01Icon, key: "voice", label: t("log.add.voice") },
        { href: "/transactions/scan", icon: ScanIcon, key: "scan", label: t("log.add.scan") },
        { href: null, icon: FileImportIcon, key: "import", label: t("log.add.import") },
    ];
    // Until the first layout there is no room to measure, so nothing is dropped.
    const kept = room === 0 ? ranked.length : fabMenuFit(ranked.length, room, fontScale);
    // The menu reads top to bottom, so the least-reached-for item sits furthest from the thumb.
    const actions = ranked.slice(0, kept).reverse();

    const fabStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(progress.get(), [0, 1], [m3.primaryContainer, m3.primary]),
        borderRadius: interpolate(progress.get(), [0, 1], [FAB_CORNER, FAB_SIZE / 2]),
    }));
    const plusStyle = useAnimatedStyle(() => ({
        opacity: 1 - progress.get(),
        transform: [{ rotate: `${progress.get() * 90}deg` }],
    }));
    const closeStyle = useAnimatedStyle(() => ({
        opacity: progress.get(),
        transform: [{ rotate: `${(progress.get() - 1) * 90}deg` }],
    }));

    return (
        <>
            {/* Measures the screen's content area, which is what the menu has to fit in. */}
            <View
                onLayout={(event) => setRoom(event.nativeEvent.layout.height)}
                pointerEvents="none"
                style={StyleSheet.absoluteFill}
                testID="fab-room"
            />
            {open ? (
                <Animated.View
                    entering={FadeIn.duration(150)}
                    exiting={FadeOut.duration(150)}
                    style={StyleSheet.absoluteFill}
                >
                    <Pressable
                        accessibilityLabel={t("common.close")}
                        accessibilityRole="button"
                        onPress={() => toggle(false)}
                        style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(m3.scrim, SCRIM_ALPHA) }]}
                    />
                </Animated.View>
            ) : null}
            <View className="absolute items-end" pointerEvents="box-none" style={{ bottom: EDGE, right: EDGE }}>
                {open ? (
                    <View className="items-end" style={{ gap: ITEM_GAP, marginBottom: MENU_GAP }}>
                        {actions.map((action, index) => (
                            <MenuItem
                                action={action}
                                // Nearest the FAB arrives first.
                                delay={(actions.length - 1 - index) * STAGGER_MS}
                                key={action.key}
                                onSelect={select}
                            />
                        ))}
                    </View>
                ) : null}
                <AnimatedPressable
                    accessibilityLabel={t("log.add.menu")}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                    android_ripple={{ color: withAlpha(m3.onPrimaryContainer, PRESSED_ALPHA) }}
                    className="items-center justify-center overflow-hidden"
                    onPress={() => toggle(!open)}
                    style={[{ elevation: FAB_ELEVATION, height: FAB_SIZE, width: FAB_SIZE }, fabStyle]}
                >
                    <Animated.View className="absolute" style={plusStyle}>
                        <HugeiconsIcon
                            color={m3.onPrimaryContainer}
                            icon={PlusSignIcon}
                            size={ICON_SIZE}
                            strokeWidth={ICON_STROKE}
                        />
                    </Animated.View>
                    <Animated.View className="absolute" style={closeStyle}>
                        <HugeiconsIcon
                            color={m3.onPrimary}
                            icon={Cancel01Icon}
                            size={ICON_SIZE}
                            strokeWidth={ICON_STROKE}
                        />
                    </Animated.View>
                </AnimatedPressable>
            </View>
            <ImportSheet ref={importSheetRef} />
        </>
    );
}

function MenuItem({
    action,
    delay,
    onSelect,
}: {
    action: AddAction;
    delay: number;
    onSelect: (action: AddAction) => void;
}) {
    const m3 = useMaterialColors();
    return (
        <Animated.View
            entering={FadeInDown.springify().delay(delay)}
            exiting={FadeOut.duration(100)}
            style={{ elevation: ITEM_ELEVATION }}
            className="bg-m3-primary-container overflow-hidden rounded-full"
        >
            <Pressable
                accessibilityLabel={action.label}
                accessibilityRole="button"
                android_ripple={{ color: withAlpha(m3.onPrimaryContainer, PRESSED_ALPHA) }}
                className="min-h-14 flex-row items-center gap-3 py-2 pr-6 pl-5"
                onPress={() => onSelect(action)}
            >
                <HugeiconsIcon
                    color={m3.onPrimaryContainer}
                    icon={action.icon}
                    size={ICON_SIZE}
                    strokeWidth={ICON_STROKE}
                />
                <Text className="font-sans-medium text-body text-m3-on-primary-container shrink" numberOfLines={2}>
                    {action.label}
                </Text>
            </Pressable>
        </Animated.View>
    );
}
