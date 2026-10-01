import { posthog } from "posthog-js";

export type Consent = "denied" | "granted" | "pending";

const TOKEN = import.meta.env.PROD ? import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN : undefined;

const ASK_FIRST = new Set([
    "AT",
    "AX",
    "BE",
    "BG",
    "CY",
    "CZ",
    "DE",
    "DK",
    "EE",
    "ES",
    "FI",
    "FR",
    "GB",
    "GF",
    "GP",
    "GR",
    "HR",
    "HU",
    "IE",
    "IS",
    "IT",
    "LI",
    "LT",
    "LU",
    "LV",
    "MF",
    "MQ",
    "MT",
    "NL",
    "NO",
    "PL",
    "PT",
    "RE",
    "RO",
    "SE",
    "SI",
    "SK",
    "T1",
    "XX",
    "YT",
]);

let started = false;
const listeners = new Set<() => void>();

function notify() {
    for (const listener of listeners) {
        listener();
    }
}

export function startAnalytics(country: string | null) {
    if (!TOKEN || started) {
        return;
    }
    posthog.init(TOKEN, {
        advanced_disable_feature_flags: true,
        api_host: "https://relay.tryoutlayr.com",
        capture_exceptions: true,
        cookieless_mode: "on_reject",
        defaults: "2026-08-30",
        ui_host: "https://us.posthog.com",
    });
    const sendsGpc = "globalPrivacyControl" in navigator && navigator.globalPrivacyControl === true;
    const asksFirst = country === null || ASK_FIRST.has(country) || sendsGpc;
    if (!asksFirst && posthog.get_explicit_consent_status() === "pending") {
        posthog.opt_in_capturing({ captureEventName: false });
    }
    started = true;
    notify();
}

export function readConsent(): Consent | null {
    return started ? posthog.get_explicit_consent_status() : null;
}

export function subscribeConsent(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function chooseConsent(granted: boolean) {
    if (granted) {
        posthog.opt_in_capturing();
    } else {
        posthog.opt_out_capturing();
    }
    notify();
}
