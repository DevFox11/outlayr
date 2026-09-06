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
import { useWindowDimensions } from "react-native";
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
    kept: number;
}

/**
 * Every action at its natural label height when the screen has the room; else
 * the labels clamp to two lines, then one, and only then do actions drop off
 * the top of the dial — the last one standing is always "Add a transaction".
 */
function fitDial(actionCount: number, room: number, fontScale: number): DialFit {
    const fits = (count: number, lines: LabelLines) => dialHeight(count, fontScale, lines) <= room;

    for (const lines of [null, 2, 1] as const) {
        if (fits(actionCount, lines)) {
            return { kept: actionCount, lines };
        }
    }
    return { kept: fittingActionCount(actionCount, room, fontScale, 1), lines: 1 };
}

interface AddAction {
    icon: IconSvgElement;
    key: string;
    label: string;
    onPress: () => void;
}

function DialAction({ action, lines }: { action: AddAction; lines: LabelLines }) {
    // SAFETY: `--foreground` is declared in global.css for both schemes.
    const foreground = useCSSVariable("--foreground") as string;

    return (
        <Fab.Action
            icon={<HugeiconsIcon color={foreground} icon={action.icon} size={ACTION_ICON_SIZE} strokeWidth={1.8} />}
            label={action.label}
            labelClassName={labelClassName(lines)}
            onPress={action.onPress}
        />
    );
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

    const room = windowHeight - insets.top - insets.bottom - DIAL_BOTTOM_INSET;
    // Bottom-up by how often each is reached for: the transaction always, then
    // moving money, speaking, scanning, and a CSV import last.
    const ranked: AddAction[] = [
        {
            icon: ReceiptDollarIcon,
            key: "transaction",
            label: t("log.add.transaction"),
            onPress: () => router.push("/transactions/create"),
        },
        ...(canTransfer
            ? [
                  {
                      icon: ArrowDataTransferHorizontalIcon,
                      key: "transfer",
                      label: t("log.add.transfer"),
                      onPress: () => router.push("/transactions/transfers/create"),
                  },
              ]
            : []),
        { icon: Mic01Icon, key: "voice", label: t("log.add.voice"), onPress: () => router.push("/transactions/voice") },
        { icon: ScanIcon, key: "scan", label: t("log.add.scan"), onPress: () => router.push("/transactions/scan") },
        { icon: FileImportIcon, key: "import", label: t("log.add.import"), onPress: presentImport },
    ];
    const { kept, lines } = fitDial(ranked.length, room, fontScale);
    // The dial reads top to bottom, so the least-reached-for action sits furthest from the thumb.
    // oxlint-disable-next-line react/react-compiler -- `presentImport` reads the sheet's ref when it is pressed, never during render; the rule tracks the function value into any array it lands in, and the alternative is not putting the import in the list at all
    const actions = ranked.slice(0, kept).reverse();

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
                    {actions.map((action) => (
                        <DialAction action={action} key={action.key} lines={lines} />
                    ))}
                </Fab.Group>
            </ScopedVariables>
            <ImportSheet ref={importSheetRef} />
        </>
    );
}
