import { useSyncExternalStore } from "react";
import { useIntlayer } from "react-intlayer";

import { chooseConsent, readConsent, subscribeConsent } from "@/lib/analytics";

import { LocalizedLink } from "./localized-link";

export function ConsentBanner() {
    const { consent: labels } = useIntlayer("site");
    const consent = useSyncExternalStore(subscribeConsent, readConsent, () => null);
    if (consent !== "pending") {
        return null;
    }
    return (
        <section
            aria-label={labels.label}
            className="bg-background border-foreground fixed bottom-5 left-5 z-20 w-[min(22rem,calc(100vw-2.5rem))] border font-mono print:hidden"
        >
            <div className="border-border flex items-baseline justify-between border-b px-4 py-2.5">
                <h2 className="text-micro text-muted uppercase">{labels.label}</h2>
                <LocalizedLink
                    className="text-micro text-muted hover:text-foreground uppercase underline underline-offset-4 transition-colors duration-150"
                    hash={labels.anchor.value}
                    to="/privacy"
                >
                    {labels.privacy}
                </LocalizedLink>
            </div>
            <p className="px-4 py-3.5 font-sans text-sm">{labels.body}</p>
            <div className="border-foreground grid grid-cols-2 border-t text-sm font-medium">
                <button
                    className="border-foreground hover:bg-surface border-r py-3 transition-colors duration-150"
                    onClick={() => chooseConsent(false)}
                    type="button"
                >
                    {labels.decline}
                </button>
                <button
                    className="bg-foreground text-background py-3"
                    onClick={() => chooseConsent(true)}
                    type="button"
                >
                    {labels.allow}
                </button>
            </div>
        </section>
    );
}
