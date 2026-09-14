import SquareLock02Icon from "@hugeicons-pro/core-solid-rounded/SquareLock02Icon";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { createContext, use, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AppState, Pressable, View } from "react-native";

import { Text } from "@/components/text";
import { useAppSettings } from "@/contexts/display-settings-context";
import { lockFailureMessage, lockGate, lockIsUnenforceable, relocksOnPhase } from "@/domain/app-lock";
import type { TranslationKey } from "@/i18n/catalog";
import { useTranslation } from "@/i18n/context";
import { lockIsEnforceable, requestUnlock } from "@/lib/app-lock";
import { useColors } from "@/theme/use-colors";

const LockOpenContext = createContext(true);

export function useAppLockOpen(): boolean {
    return use(LockOpenContext);
}

/**
 * Holds the shield over `children` rather than swapping them out: unmounting the
 * navigator on every lock would discard the whole navigation stack, so returning
 * from a background would drop the user back on the Log.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
    const t = useTranslation();
    const { state: settings } = useAppSettings();
    const enabled = settings.bool("biometricLock");
    const [unlocked, setUnlocked] = useState(false);
    const [enforceable, setEnforceable] = useState<boolean | null>(null);
    const [failure, setFailure] = useState<TranslationKey | null>(null);
    const [checking, setChecking] = useState(false);

    // Seeded from the mount-time setting, so a launch with the lock already on is
    // never mistaken for the user having just turned it on.
    const armed = useRef(enabled);
    useEffect(() => {
        const turnedOn = enabled && !armed.current;
        armed.current = enabled;
        if (!enabled) {
            // oxlint-disable-next-line react/react-compiler -- discards the result of a biometric check that may still be in flight; the three values are answers from the device, not functions of `enabled`.
            setEnforceable(null);
            setUnlocked(false);
            setFailure(null);
            return;
        }
        // The Settings toggle only flips on behind a passed check; prompting again
        // here would be two prompts for one action.
        if (turnedOn) {
            setUnlocked(true);
        }
        let cancelled = false;
        lockIsEnforceable().then((ok) => {
            if (!cancelled) {
                setEnforceable(ok);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [enabled]);

    useEffect(() => {
        const subscription = AppState.addEventListener("change", (phase) => {
            if (relocksOnPhase(phase)) {
                setUnlocked(false);
            }
        });
        return () => {
            subscription.remove();
        };
    }, []);

    const attempt = useCallback(async () => {
        setChecking(true);
        const result = await requestUnlock(t("transaction.lock.prompt"));
        setChecking(false);
        if (result.success) {
            setFailure(null);
            setUnlocked(true);
            return;
        }
        if (lockIsUnenforceable(result.error)) {
            setEnforceable(false);
            return;
        }
        setFailure(lockFailureMessage(result.error));
    }, [t]);

    const gate = lockGate(enabled, unlocked, enforceable);

    // One automatic prompt per shut gate. Re-prompting on every render would
    // reopen a sheet the user just dismissed, which is unescapable.
    const prompted = useRef(false);
    useEffect(() => {
        if (gate === "open") {
            prompted.current = false;
            return;
        }
        if (enforceable !== true || prompted.current) {
            return;
        }
        prompted.current = true;
        // oxlint-disable-next-line no-void -- the prompt is deliberately not awaited, and requestUnlock (lib/app-lock.ts:21-31) resolves a result object for every failure, so there is no rejection a .catch could handle
        void attempt();
    }, [gate, enforceable, attempt]);

    return (
        <View className="flex-1">
            <LockOpenContext.Provider value={gate === "open"}>{children}</LockOpenContext.Provider>
            {gate === "shut" ? (
                <AppLockScreen
                    busy={checking}
                    message={failure ? t(failure) : null}
                    onUnlock={() => {
                        // oxlint-disable-next-line no-void -- the prompt is deliberately not awaited, and requestUnlock (lib/app-lock.ts:21-31) resolves a result object for every failure, so there is no rejection a .catch could handle
                        void attempt();
                    }}
                />
            ) : null}
        </View>
    );
}

function AppLockScreen({ busy, message, onUnlock }: { busy: boolean; message: string | null; onUnlock: () => void }) {
    const colors = useColors();
    const t = useTranslation();

    return (
        <View className="bg-background absolute inset-0 items-center justify-center gap-4 px-8">
            <HugeiconsIcon color={colors.subtle} icon={SquareLock02Icon} size={56} />
            <Text className="font-sans-semibold text-foreground text-title">{t("transaction.lock.title")}</Text>

            <Pressable
                accessibilityRole="button"
                className="bg-accent rounded-xl px-6 py-3 active:opacity-80 disabled:opacity-50"
                disabled={busy}
                onPress={onUnlock}
            >
                <Text className="font-sans-semibold text-accent-foreground text-body">
                    {t(busy ? "transaction.lock.checking" : "transaction.lock.unlock")}
                </Text>
            </Pressable>

            {message ? <Text className="text-label text-muted text-center">{message}</Text> : null}
        </View>
    );
}
