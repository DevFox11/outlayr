import { useLocation } from "@tanstack/react-router";
import { getLocalizedUrl, getPathWithoutLocale, locales } from "intlayer";
import { useIntlayer, useLocale } from "react-intlayer";

import { LANGUAGES } from "@/lib/i18n";

export function LanguageSwitch() {
    const { footer } = useIntlayer("site");
    const { locale } = useLocale();
    const path = getPathWithoutLocale(useLocation({ select: (location) => location.pathname }));

    return (
        <nav aria-label={footer.language.value} className="border-border flex rounded-full border p-1">
            {locales.map((option) => (
                <a
                    aria-current={option === locale ? "page" : undefined}
                    className="fluid text-muted hover:text-foreground aria-[current=page]:bg-foreground/5 aria-[current=page]:text-foreground rounded-full px-3 py-1 text-sm"
                    href={getLocalizedUrl(path, option)}
                    hrefLang={LANGUAGES[option].hreflang}
                    key={option}
                    lang={LANGUAGES[option].lang}
                >
                    {LANGUAGES[option].name}
                </a>
            ))}
        </nav>
    );
}
