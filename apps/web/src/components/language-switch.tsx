import { useLocation } from "@tanstack/react-router";
import { getLocalizedUrl, getPathWithoutLocale, locales } from "intlayer";
import { useIntlayer, useLocale } from "react-intlayer";

import { LANGUAGES } from "@/lib/i18n";

import { FOOTER_ROW } from "./footer-row";

export function LanguageSwitch() {
    const { footer } = useIntlayer("site");
    const { locale } = useLocale();
    const path = getPathWithoutLocale(useLocation({ select: (location) => location.pathname }));

    return (
        <nav aria-label={footer.language.value} className={FOOTER_ROW}>
            <span aria-hidden="true" className="text-micro text-muted uppercase">
                {footer.language}
            </span>
            <div className="flex justify-end gap-x-4 text-[0.8125rem] sm:text-sm">
                {locales.map((option) => (
                    <a
                        aria-current={option === locale ? "page" : undefined}
                        className="text-muted hover:text-foreground aria-[current=page]:text-foreground aria-[current=page]:decoration-tint underline-offset-4 transition-colors duration-150 aria-[current=page]:underline aria-[current=page]:decoration-2"
                        href={getLocalizedUrl(path, option)}
                        hrefLang={LANGUAGES[option].hreflang}
                        key={option}
                        lang={LANGUAGES[option].lang}
                    >
                        {LANGUAGES[option].name}
                    </a>
                ))}
            </div>
        </nav>
    );
}
