import { getLocalizedUrl } from "intlayer";
import { useIntlayer, useLocale } from "react-intlayer";

import { LocalizedLink } from "./localized-link";
import { Page } from "./page";

const PAGES = [
    { id: "home", to: "/" },
    { id: "support", to: "/support" },
    { id: "terms", to: "/terms" },
    { id: "privacy", to: "/privacy" },
] as const;

export function NotFound() {
    const { notFound } = useIntlayer("site");
    const { locale } = useLocale();
    return (
        <Page meta={notFound.meta} title={notFound.title}>
            <ul className="border-foreground mt-10 max-w-sm border-t font-mono text-xs md:mt-14">
                {PAGES.map((page) => (
                    <li className="border-border border-b" key={page.id}>
                        <LocalizedLink
                            className="hover:bg-surface flex justify-between gap-6 py-2.5 transition-colors duration-150"
                            to={page.to}
                        >
                            {notFound.pages[page.id]}
                            <span className="text-muted">{getLocalizedUrl(page.to, locale)}</span>
                        </LocalizedLink>
                    </li>
                ))}
            </ul>
        </Page>
    );
}
