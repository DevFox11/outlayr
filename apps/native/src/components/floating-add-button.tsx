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
import { useCallback, useMemo, useRef, useState } from "react";
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

/**
 * Sits above the safe area, which under `NativeTabs` already spans the whole tab
 * bar plus the home indicator. This is the gap over the bar, not the clearance
 * for it — the `bottom-safe-offset-17` (68pt) inherited from the SwiftUI menu
 * added a second bar's height of dead space on top of an inset that had already
 * cleared it.
 */
const DIAL_BOTTOM_INSET = 16;
const DIAL_EDGE_INSET = 20;
/** Sized against the 56pt action circles `size="lg"` produces, not the 44pt default. */
const ACTION_ICON_SIZE = 22;
const TRIGGER_ICON_SIZE = 26;
/** What an action that cannot run yet is dimmed to. */
const PENDING_OPACITY = 0.45;

/**
 * What the open dial occupies at `size="lg"`: 56pt action circles under a 64pt
 * trigger, with panelui's `gap-3` between every child.
 */
const ACTION_HEIGHT = 56;
const TRIGGER_HEIGHT = 64;
const DIAL_GAP = 12;

/**
 * What the label chip is capped at, and what it costs when it wraps against that
 * cap. Dynamic Type scales the label, and a wrapped chip is taller than the
 * circle beside it, so the column's height is a function of the text scale too.
 */
const LABEL_MAX_WIDTH = 200;
const LONGEST_LABEL_WIDTH = 190;
const LABEL_LINE_HEIGHT = 21;
const CHIP_PADDING_Y = 8;

/**
 * How many lines the label chip may use. `null` is as many as the text needs.
 *
 * Giving up lines is what keeps every runnable action reachable when the column
 * cannot fit at full height: a clamped chip is ~73pt against ~203pt unclamped at
 * an accessibility text size, and the full string still reaches VoiceOver
 * through the action's accessibility label either way.
 */
type LabelLines = 1 | 2 | null;

/** Static because uniwind extracts classes at build time. */
function labelClassName(lines: LabelLines) {
    if (lines === 1) {
        return "line-clamp-1 max-w-[200px] text-base";
    }
    if (lines === 2) {
        return "line-clamp-2 max-w-[200px] text-base";
    }
    return "max-w-[200px] text-base";
}

/** What the longest label actually wraps to, once a clamp is applied. */
function chipLines(fontScale: number, lines: LabelLines) {
    const natural = Math.ceil((LONGEST_LABEL_WIDTH * fontScale) / LABEL_MAX_WIDTH);
    return lines === null ? natural : Math.min(natural, lines);
}

/**
 * How tall one action stands at a given text scale and line allowance.
 *
 * The line count is estimated from the longest label rather than measured:
 * `Fab.Action` gives no layout hook, and measuring then dropping would need a
 * second pass the user would see. Over-reserving costs at most one unbuilt
 * action; under-reserving puts a real one off-screen, so this rounds up.
 */
function actionHeight(fontScale: number, lines: LabelLines) {
    return Math.max(ACTION_HEIGHT, CHIP_PADDING_Y + chipLines(fontScale, lines) * LABEL_LINE_HEIGHT * fontScale);
}

/** How tall the column stands when open, trigger included. */
const dialHeight = (actionCount: number, fontScale: number, lines: LabelLines) =>
    actionCount * (actionHeight(fontScale, lines) + DIAL_GAP) + TRIGGER_HEIGHT;

/**
 * The most actions that fit, never fewer than one: one row and the trigger are
 * 132pt, so the ladder below always has somewhere to land.
 */
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

/**
 * What the dial can afford to show, giving things up in order of what costs the
 * user least: the unbuilt actions first (they are inert), then the label's
 * second and third lines, and only then a runnable action.
 *
 * The order matters — dropping a working command is the last resort, not the
 * first, so an iPhone in landscape at an accessibility text size keeps all three
 * runnable actions with clamped labels rather than losing two of them.
 */
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
    return { keptRunnable: fittingActionCount(runnableCount, room, fontScale, 1), lines: 1, showPending: false };
}

/**
 * One choice in the dial. An action without `onPress` has not been built yet: it
 * stays in the dial, dimmed and marked, so the dial shows where it is going.
 */
interface AddAction {
    icon: IconSvgElement;
    key: string;
    label: string;
    /**
     * Not built yet. Stated rather than inferred from a missing `onPress`: the
     * handlers close over the import sheet's ref, so a predicate that reads one
     * during render is a ref read, which the React Compiler rejects.
     */
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
            // `Fab.Action`'s label is a plain string with no room beside it, so
            // the marker is part of it. It doubles as the action's accessibility
            // label, which is where an unrunnable choice most needs saying.
            label={pending ? `${action.label} · ${t("log.add.soon")}` : action.label}
            // The chip's `Text` is `size="sm"`, which reads small beside a 56pt
            // circle. Nothing styles the chip itself, so bumping the text is also
            // what grows the chip: its padding is fixed and the text inside is not.
            //
            // The cap is what keeps it on screen once Dynamic Type scales it: the
            // row is right-aligned beside a fixed circle and grows leftward, so an
            // uncapped label runs off the left edge instead of wrapping. Sized for
            // a 320pt viewport, which leaves 212pt after the 20 edge inset, 56
            // circle, 12 gap and 20 chip padding.
            labelClassName={labelClassName(lines)}
            onPress={action.onPress}
        />
    );

    // The dim goes on a wrapper rather than the action itself. `Fab.Action`'s own
    // disabled styling is an `opacity` class on panelui's `AnimatedPressable`,
    // which writes `opacity` from a `useAnimatedStyle` and wins — the same reason
    // `editor-cta.tsx` dims from outside.
    return pending ? <View style={{ opacity: PENDING_OPACITY }}>{dialAction}</View> : dialAction;
}

export function FloatingAddButton() {
    // `--tint`, not `--color-primary`: this is the one control on the ledger that
    // starts something rather than reporting it, and it is where the brand gets to
    // speak. Every figure around it stays ink.
    // SAFETY: `--tint` is declared in global.css for both schemes, so uniwind's
    // `string | undefined` cannot be undefined here.
    const accentColor = useCSSVariable("--tint") as string;
    // SAFETY: `--accent-foreground` is declared directly in both `:root` blocks
    // rather than only bridged through `@theme inline`, which is what this lookup
    // reads. It is the glyph colour that clears AA on the tint in both schemes.
    const onAccent = useCSSVariable("--accent-foreground") as string;
    const t = useTranslation();
    const insets = useSafeAreaInsets();
    const [open, setOpen] = useState(false);
    const haptics = useHaptics();

    // Shut on the way out, in the blur cleanup. The scrim covers the screen but
    // not the tab bar, which belongs to the navigator drawn above it, so a tab
    // can be tapped with the dial open. `NativeTabs` keeps every tab mounted and
    // the Log is never wrapped in `FreezeOnBlur`, so the dial's own state
    // survives the trip: without this, coming back lands on an open dial over a
    // blurred ledger.
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
    // Hoisted out of the action list rather than written inline there. An inline
    // handler makes every element of that list hold the sheet's ref, and the
    // React Compiler then reads any array derived from it during render as a ref
    // access — which is what deciding the dial's height has to do.
    const presentImport = useCallback(() => {
        importDraftStore.setStep(importDraftStore.getResumeStep());
        importSheetRef.current?.present();
    }, []);
    const canTransfer = useAccounts(useDatabase()).length >= 2;

    // Shown but not wired yet, so it carries no handler and no ref with it.
    const pendingActions: AddAction[] = [{ icon: ScanIcon, key: "scan", label: t("log.add.scan"), pending: true }];

    // The dial unfolds upward and cannot scroll, so when the column outgrows the
    // window its top lands off-screen and cannot be reached. Two things cause
    // that: a short window (any iPhone in landscape, ~440pt against the 404pt
    // five actions need) and a large text scale, which wraps the chips to three
    // lines and roughly quadruples a row. Together they can outgrow it by enough
    // that dropping the two unbuilt actions is not sufficient, so what survives
    // is whatever fits, sacrificed in reverse priority: the unbuilt pair first
    // because they are inert, then the import, then the transfer.
    //
    // Decided here rather than by filtering the built list: `presentImport`
    // holds the sheet's ref, so every array derived from that list reads as a
    // ref access during render and the React Compiler rejects it.
    const room = windowHeight - insets.top - insets.bottom - DIAL_BOTTOM_INSET;
    const runnableCount = canTransfer ? 4 : 3;
    const { keptRunnable, lines, showPending } = fitDial(runnableCount, pendingActions.length, room, fontScale);
    const showTransfer = canTransfer && keptRunnable >= 2;
    // Voice and import are the last of the runnable set to keep: voice needs
    // everything but the import, and the import needs all of it.
    const showVoice = keptRunnable >= runnableCount - 1;
    const showImport = keptRunnable >= runnableCount;

    // Written in the order the column renders, which is bottom-up: the dial grows
    // upward from the trigger, so the LAST entry is the one nearest the thumb and
    // therefore the most wanted. Reading up from there: recording what you just
    // spent, then moving money you already have, then saying it instead of
    // typing it, then the way of recording that is still coming, then the
    // one-off that seeds a ledger.
    //
    // Nothing here closes the dial. `Fab.Action` does that itself before running.
    const actions: AddAction[] = [
        ...(showImport
            ? [{ icon: FileImportIcon, key: "import", label: t("log.add.import"), onPress: presentImport }]
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

    // panelui's own `haptics` prop calls the taptic engine directly, which
    // `use-haptics.ts` exists to stop: a direct call is unconditional, so it
    // would tick straight through Settings → Haptics → None. Same feedback,
    // same `selection` event, routed through the wrapper that reads the setting.
    const toggleDial = useCallback(
        (next: boolean) => {
            setOpen(next);
            haptics("selection");
        },
        [haptics]
    );

    // panelui's `Fab` paints its trigger `bg-primary`, and in this app
    // `--color-primary` is ink — left alone the add button turns black. The
    // variable is rebound for this subtree only; on native `ScopedVariables` is a
    // context provider and adds no view, so the group's scrim still measures
    // against the screen.
    const tinted = useMemo(() => ({ "--color-primary": accentColor }), [accentColor]);

    return (
        <>
            <ScopedVariables variables={tinted}>
                <Fab.Group
                    accessibilityLabel={t("log.add.menu")}
                    // Frosts the ledger instead of dimming it, which keeps the rows
                    // readable as shape and colour behind the dial. It needs
                    // `expo-blur` present: panelui resolves it lazily and falls back
                    // to a plain dim rather than failing, so a missing dependency
                    // here is silent. The tab bar is not covered either way — the
                    // scrim is absolute-fill inside the screen and `NativeTabs`
                    // floats above it.
                    blur
                    onOpenChange={toggleDial}
                    open={open}
                    // The only way to grow the actions: `Fab.Action` has no size of
                    // its own and steps down from whatever the group is, so `lg`
                    // takes them from 44pt to 56pt. The trigger grows to 64pt with
                    // them, which is the point — it stays the one that leads.
                    size="lg"
                    icon={
                        <HugeiconsIcon
                            color={onAccent}
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
