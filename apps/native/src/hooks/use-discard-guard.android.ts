import { useNavigation, usePreventRemove, useRouter } from "expo-router";
import type { NativeStackNavigationProp } from "expo-router";
import type { ParamListBase } from "expo-router/react-navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Alert } from "react-native";

import { notifyEditsDiscarded } from "@/components/edits-discarded-snackbar";
import { useTranslation } from "@/i18n/context";

import type { useDiscardGuard as useDiscardGuardBase, SwipeDiscardRecovery } from "./use-discard-guard";

/**
 * `use-discard-guard.ts` on Android, with three differences: the screen leaves
 * a commit after its guard comes down, not in the same one; a sheet the user
 * swipes away leaves without asking; and the dialog carries a one-line message.
 *
 * The swipe: react-native-screens ignores `preventNativeDismiss` on Android, so
 * a sheet dragged down is hidden whatever the guard says, and a guard still up
 * when its dismissal lands keeps a screen in the JS state that the user can no
 * longer see. So the guard stands down while the sheet is being dragged (an
 * unstable `sheetDetentChange`) and comes back when it settles. Only the sheet
 * reporting itself hidden counts as a swipe: everything else asks, the close
 * button and system back included, and so does a full-screen dialog's app-bar
 * X, which reaches the guard as the same `POP` a dismissed sheet sends. A sheet
 * that opts into `recovery` gets its edits back from the swipe: they are read
 * as the sheet reports itself hidden, and an "Edits discarded" snackbar offers
 * them with an Undo.
 *
 * The native stack derives a header prop (`headerBackButtonMenuEnabled`) from
 * the guard. Lowered in the same commit as the pop, that prop update reaches a
 * header whose screen has already left its stack, and react-native-screens
 * throws ("ScreenStackFragment added into a non-stack container"), which took
 * the app down on every save and every discard.
 */
export const useDiscardGuard: typeof useDiscardGuardBase = <Draft>(recovery?: SwipeDiscardRecovery<Draft>) => {
    const router = useRouter();
    const t = useTranslation();
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
    const [dirty, setDirty] = useState(false);
    const [dragging, setDragging] = useState(false);
    // The way out, held until the commit that lowers the guard has landed.
    const [exit, setExit] = useState<(() => void) | null>(null);
    // Read from the detent listener, which outlives any one render.
    const latest = useRef({ dirty, recovery });
    useLayoutEffect(() => {
        latest.current = { dirty, recovery };
    });
    /** The sheet reported itself hidden: a swipe took it, and its dismissal follows. */
    const hidden = useRef(false);
    const leaving = useRef(false);

    // Only a sheet sends these, so a full-screen dialog never stands down.
    useEffect(
        () =>
            navigation.addListener("sheetDetentChange", ({ data: { index, stable } }) => {
                if (!stable) {
                    setDragging(true);
                    return;
                }
                if (index < 0) {
                    // The guard stays down for the dismissal; the edits go to the snackbar.
                    hidden.current = true;
                    const { dirty: unsaved, recovery: recover } = latest.current;
                    const draft = unsaved ? (recover?.snapshot() ?? null) : null;
                    if (draft !== null && recover !== undefined) {
                        notifyEditsDiscarded(() => recover.restore(draft));
                    }
                    return;
                }
                hidden.current = false;
                setDragging(false);
            }),
        [navigation]
    );

    const disablePrevention = usePreventRemove(dirty && !dragging, ({ repeat }) => {
        // A swiped-away sheet whose guard could not stand down in time: it is
        // already hidden, so asking would leave a screen nobody can see. A sheet
        // has no app bar, so the header crash above cannot happen here.
        if (hidden.current) {
            repeat();
            return;
        }
        // A message, unlike iOS: the Material dialog keeps its message area
        // open without one, so a title alone sits over an empty band.
        Alert.alert(
            t("common.discard.title"),
            t("common.discard.body"),
            [
                { style: "cancel", text: t("common.discard.keep") },
                {
                    onPress: () => {
                        setDirty(false);
                        setExit(() => repeat);
                    },
                    style: "destructive",
                    text: t("common.discard.confirm"),
                },
            ],
            { cancelable: true }
        );
    });

    useEffect(() => {
        exit?.();
    }, [exit]);

    const leave = () => {
        if (leaving.current) {
            return false;
        }
        leaving.current = true;
        setDirty(false);
        disablePrevention();
        setExit(() => () => router.back());
        return true;
    };

    return { leave, setDirty };
};
