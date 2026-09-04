import {
    ArrowDataTransferHorizontalIcon,
    FileImportIcon,
    Mic01Icon,
    PlusSignIcon,
    ReceiptDollarIcon,
    ScanIcon,
} from "@hugeicons-pro/core-stroke-rounded";
import { HugeiconsIcon } from "@hugeicons/react-native";
import type { IconSvgElement } from "@hugeicons/react-native";
import { router, useFocusEffect } from "expo-router";
import { Fab } from "panelui-native";
import { useCallback, useRef, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScopedVariables, useCSSVariable } from "uniwind";

import { ImportSheet } from "@/components/import-sheet/import-sheet";
import type { ImportSheetHandle } from "@/components/import-sheet/import-sheet";
import { useDatabase } from "@/contexts/local-data-context";
import { useAccounts } from "@/data/accounts";
import { useTranslation } from "@/i18n/context";
import { importDraftStore } from "@/lib/import-draft-store";
import { useHaptics } from "@/lib/use-haptics";
import { useColors } from "@/theme/use-colors";

const DIAL_BOTTOM_INSET = 16;
const DIAL_EDGE_INSET = 20;
const ACTION_ICON_SIZE = 22;
const TRIGGER_ICON_SIZE = 26;
const PENDING_OPACITY = 0.45;

const ACTION_HEIGHT = 56;
const TRIGGER_HEIGHT = 64;
const DIAL_GAP = 12;

const LABEL_MAX_WIDTH = 200;
const LONGEST_LABEL_WIDTH = 190;
const LABEL_LINE_HEIGHT = 21;
const CHIP_PADDING_Y = 8;

type LabelLines = 1 | 2 | null;

function labelClassName(lines: LabelLines) {
    if (lines === 1) {
        return "line-clamp-1 max-w-[200px] text-base";
    }
    if (lines === 2) {
        return "line-clamp-2 max-w-[200px] text-base";
    }
    return "max-w-[200px] text-base";
}

function chipLines(fontScale: number, lines: LabelLines) {
    const natural = Math.ceil((LONGEST_LABEL_WIDTH * fontScale) / LABEL_MAX_WIDTH);
    return lines === null ? natural : Math.min(natural, lines);
}

function actionHeight(fontScale: number, lines: LabelLines) {
    return Math.max(ACTION_HEIGHT, CHIP_PADDING_Y + chipLines(fontScale, lines) * LABEL_LINE_HEIGHT * fontScale);
}

const dialHeight = (actionCount: number, fontScale: number, lines: LabelLines) =>
    actionCount * (actionHeight(fontScale, lines) + DIAL_GAP) + TRIGGER_HEIGHT;

function fittingActionCount(candidates: number, room: number, fontScale: number, lines: LabelLines) {
    for (let count = candidates; count > 1; count -= 1) {
        if (dialHeight(count, fontScale, lines) <= room) {
            return count;
        }
    }
    return 1;
}

interface DialFit {
    lines: LabelLines;
    keptRunnable: number;
    showPending: boolean;
}

function fitDial(runnableCount: number, pendingCount: number, room: number, fontScale: number): DialFit {
    const fits = (count: number, lines: LabelLines) => dialHeight(count, fontScale, lines) <= room;

    if (fits(runnableCount + pendingCount, null)) {
        return { keptRunnable: runnableCount, lines: null, showPending: true };
    }
    for (const lines of [null, 2, 1] as const) {
        if (fits(runnableCount, lines)) {
            return { keptRunnable: runnableCount, lines, showPending: false };
        }
    }
    return {
        keptRunnable: fittingActionCount(runnableCount, room, fontScale, 1),
        lines: 1,
        showPending: false,
    };
}

interface AddAction {
    icon: IconSvgElement;
    key: string;
    label: string;
    pending?: boolean;
    onPress?: () => void;
}

function DialAction({ action, lines }: { action: AddAction; lines: LabelLines }) {
    const t = useTranslation();
    // SAFETY: `--foreground` is declared in global.css for both schemes.
    const foreground = useCSSVariable("--foreground") as string;
    const pending = action.pending === true;

    const dialAction = (
        <Fab.Action
            disabled={pending}
            icon={<HugeiconsIcon color={foreground} icon={action.icon} size={ACTION_ICON_SIZE} strokeWidth={1.8} />}
            label={pending ? `${action.label} · ${t("log.add.soon")}` : action.label}
            labelClassName={labelClassName(lines)}
            onPress={action.onPress}
        />
    );

    return pending ? <View style={{ opacity: PENDING_OPACITY }}>{dialAction}</View> : dialAction;
}

export function FloatingAddButton() {
    const { tint, accentForeground } = useColors();
    const t = useTranslation();
    const insets = useSafeAreaInsets();
    const [open, setOpen] = useState(false);
    const haptics = useHaptics();

    useFocusEffect(
        useCallback(
            () => () => {
                setOpen(false);
            },
            []
        )
    );
    const { fontScale, height: windowHeight } = useWindowDimensions();
    const importSheetRef = useRef<ImportSheetHandle>(null);
    const presentImport = useCallback(() => {
        importDraftStore.setStep(importDraftStore.getResumeStep());
        importSheetRef.current?.present();
    }, []);
    const canTransfer = useAccounts(useDatabase()).length >= 2;

    const pendingActions: AddAction[] = [{ icon: ScanIcon, key: "scan", label: t("log.add.scan"), pending: true }];

    const room = windowHeight - insets.top - insets.bottom - DIAL_BOTTOM_INSET;
    const runnableCount = canTransfer ? 4 : 3;
    const { keptRunnable, lines, showPending } = fitDial(runnableCount, pendingActions.length, room, fontScale);
    const showTransfer = canTransfer && keptRunnable >= 2;
    const showVoice = keptRunnable >= runnableCount - 1;
    const showImport = keptRunnable >= runnableCount;

    const actions: AddAction[] = [
        ...(showImport
            ? [
                  {
                      icon: FileImportIcon,
                      key: "import",
                      label: t("log.add.import"),
                      onPress: presentImport,
                  },
              ]
            : []),
        ...(showPending ? pendingActions : []),
        ...(showVoice
            ? [
                  {
                      icon: Mic01Icon,
                      key: "voice",
                      label: t("log.add.voice"),
                      onPress: () => router.push("/transactions/voice"),
                  },
              ]
            : []),
        ...(showTransfer
            ? [
                  {
                      icon: ArrowDataTransferHorizontalIcon,
                      key: "transfer",
                      label: t("log.add.transfer"),
                      onPress: () => router.push("/transactions/transfers/create"),
                  },
              ]
            : []),
        {
            icon: ReceiptDollarIcon,
            key: "transaction",
            label: t("log.add.transaction"),
            onPress: () => router.push("/transactions/create"),
        },
    ];

    const toggleDial = useCallback(
        (next: boolean) => {
            setOpen(next);
            haptics("selection");
        },
        [haptics]
    );

    return (
        <>
            <ScopedVariables variables={{ "--color-primary": tint }}>
                <Fab.Group
                    accessibilityLabel={t("log.add.menu")}
                    blur
                    onOpenChange={toggleDial}
                    open={open}
                    // The only way to grow the actions: `Fab.Action` has no size of its own
                    // and steps down from the group, so `lg` takes them from 44pt to 56pt.
                    // `ACTION_HEIGHT` and `TRIGGER_HEIGHT` above budget for exactly that.
                    size="lg"
                    icon={
                        <HugeiconsIcon
                            color={accentForeground}
                            icon={PlusSignIcon}
                            size={TRIGGER_ICON_SIZE}
                            strokeWidth={2.2}
                        />
                    }
                    style={{ bottom: insets.bottom + DIAL_BOTTOM_INSET, right: DIAL_EDGE_INSET }}
                >
                    {/* oxlint-disable-next-line react/react-compiler -- `presentImport` reads the sheet's ref when it is pressed, never during render; the rule tracks the function value into any array it lands in, and the alternative is not putting the import in the list at all */}
                    {actions.map((action) => (
                        <DialAction action={action} key={action.key} lines={lines} />
                    ))}
                </Fab.Group>
            </ScopedVariables>
            <ImportSheet ref={importSheetRef} />
        </>
    );
}
