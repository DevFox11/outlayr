import { useIntlayer } from "react-intlayer";

import { CONTAINER } from "@/lib/layout";

import { LocalizedLink } from "./localized-link";
import { LogoMark } from "./logo-mark";
import { AppStoreBadge } from "./store-badges";

export function SiteHeader() {
    const { home } = useIntlayer("site");
    return (
        <header className="border-border bg-background sticky top-0 z-10 border-b print:hidden">
            <div className={`${CONTAINER} flex h-16 items-center justify-between gap-6`}>
                <LocalizedLink aria-label={home.value} className="flex items-center gap-2.5" to="/">
                    <LogoMark className="size-6" />
                    <span className="font-mono text-base font-medium">outlayr</span>
                </LocalizedLink>
                <AppStoreBadge size="small" />
            </div>
        </header>
    );
}
