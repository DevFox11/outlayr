import { getLocales } from "expo-localization";
import { useEffect, useState } from "react";
import { AppState } from "react-native";

/**
 * Only ever reaches the display catalog. Currency stays a stated choice made in
 * onboarding (§1.7) — deriving it from the locale is the guess that defect
 * exists to remove.
 */
/** Null rather than throwing when the locale list cannot be read. */
export function firstLocale() {
    try {
        return getLocales()[0] ?? null;
    } catch {
        return null;
    }
}

function deviceLanguageTag(): string | null {
    return firstLocale()?.languageTag ?? null;
}

/**
 * The device language, re-read whenever the app returns to the foreground.
 * Changing the language in iOS Settings hands the process back with a new
 * locale, so a tag captured once at mount stays stale until the next cold start.
 */
export function useDeviceLanguageTag(): string | null {
    const [tag, setTag] = useState(deviceLanguageTag);

    useEffect(() => {
        const subscription = AppState.addEventListener("change", (status) => {
            if (status !== "active") {
                return;
            }
            // Same string bails out of the re-render inside React.
            setTag(deviceLanguageTag());
        });
        return () => subscription.remove();
    }, []);

    return tag;
}
