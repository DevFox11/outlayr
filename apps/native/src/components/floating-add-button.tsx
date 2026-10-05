import ArrowDataTransferHorizontalIcon from "@hugeicons-pro/core-stroke-rounded/ArrowDataTransferHorizontalIcon";
import FileImportIcon from "@hugeicons-pro/core-stroke-rounded/FileImportIcon";
import Mic01Icon from "@hugeicons-pro/core-stroke-rounded/Mic01Icon";
import PlusSignIcon from "@hugeicons-pro/core-stroke-rounded/PlusSignIcon";
import ReceiptDollarIcon from "@hugeicons-pro/core-stroke-rounded/ReceiptDollarIcon";
import ScanIcon from "@hugeicons-pro/core-stroke-rounded/ScanIcon";
import { HugeiconsIcon } from "@hugeicons/react-native";
import type { IconSvgElement } from "@hugeicons/react-native";
import { router, useFocusEffect } from "expo-router";
import type { Href } from "expo-router";
import { Fab, useGlassMaterial } from "panelui-native";
import { useCallback, useRef, useState } from "react";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScopedVariables, useCSSVariable } from "uniwind";

import { ImportSheet } from "@/components/import-sheet/import-sheet";
import type { ImportSheetHandle } from "@/components/import-sheet/import-sheet";
import { cn } from "@/components/tw";
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

const LABEL_CLAMP = { 1: "line-clamp-1", 2: "line-clamp-2" } as const;

function labelClassName(lines: LabelLines) {
    return cn(lines === null ? null : LABEL_CLAMP[lines], "max-w-[200px] text-base");
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
    href: Href | null;
    icon: IconSvgElement;
    key: string;
    label: string;
}

function DialAction({
    action,
    lines,
    onSelect,
}: {
    action: AddAction;
    lines: LabelLines;
    onSelect: (action: AddAction) => void;
}) {
    // SAFETY: `--foreground` is declared in global.css for both schemes.
    const foreground = useCSSVariable("--foreground") as string;

    return (
        <Fab.Action
            icon={<HugeiconsIcon color={foreground} icon={action.icon} size={ACTION_ICON_SIZE} strokeWidth={1.8} />}
            label={action.label}
            labelClassName={labelClassName(lines)}
            onPress={() => onSelect(action)}
        />
    );
}

export function FloatingAddButton() {
    const { tint, accentForeground } = useColors();
    const glassDrawn = useGlassMaterial();
    const t = useTranslation();
    const insets = useSafeAreaInsets();
    const [open, setOpen] = useState(false);
    const haptics = useHaptics();

    const navigating = useRef(false);

    useFocusEffect(
        useCallback(() => {
            navigating.current = false;
            return () => {
                setOpen(false);
            };
        }, [])
    );
    const { fontScale, height: windowHeight } = useWindowDimensions();
    const importSheetRef = useRef<ImportSheetHandle>(null);
    const select = useCallback(({ href }: AddAction) => {
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
    const canTransfer = useAccounts(useDatabase()).length >= 2;

    const room = windowHeight - insets.top - insets.bottom - DIAL_BOTTOM_INSET;
    // Bottom-up by how often each is reached for: the transaction always, then
    // moving money, speaking, scanning, and a CSV import last.
    const ranked: AddAction[] = [
        {
            href: "/transactions/create",
            icon: ReceiptDollarIcon,
            key: "transaction",
            label: t("log.add.transaction"),
        },
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
    const { kept, lines } = fitDial(ranked.length, room, fontScale);
    // The dial reads top to bottom, so the least-reached-for action sits furthest from the thumb.
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
                    glass
                    onOpenChange={toggleDial}
                    open={open}
                    // The only way to grow the actions: `Fab.Action` has no size of its own
                    // and steps down from the group, so `lg` takes them from 44pt to 56pt.
                    // `ACTION_HEIGHT` and `TRIGGER_HEIGHT` above budget for exactly that.
                    size="lg"
                    icon={
                        <HugeiconsIcon
                            color={glassDrawn ? tint : accentForeground}
                            icon={PlusSignIcon}
                            size={TRIGGER_ICON_SIZE}
                            strokeWidth={2.2}
                        />
                    }
                    style={{ bottom: insets.bottom + DIAL_BOTTOM_INSET, right: DIAL_EDGE_INSET }}
                >
                    {actions.map((action) => (
                        <DialAction action={action} key={action.key} lines={lines} onSelect={select} />
                    ))}
                </Fab.Group>
            </ScopedVariables>
            <ImportSheet ref={importSheetRef} />
        </>
    );
}
