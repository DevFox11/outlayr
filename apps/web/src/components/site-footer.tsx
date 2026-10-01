import type { ReactNode } from "react";
import { useIntlayer, useLocale } from "react-intlayer";

import { LANGUAGES } from "@/lib/i18n";
import { CONTAINER } from "@/lib/layout";
import { COMPANY, SUPPORT_EMAIL, legalDate } from "@/lib/site";

import { LanguageSwitch } from "./language-switch";
import { LocalizedLink } from "./localized-link";
import { LogoMark } from "./logo-mark";
import { ThemeSwitch } from "./theme-switch";

const ROW =
    "hover:bg-surface border-border grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-4 border-b py-3.5 transition-colors duration-150 sm:grid-cols-[9rem_minmax(0,1fr)]";

function Row({ children, label }: { children: ReactNode; label: ReactNode }) {
    return (
        <>
            <span className="text-micro text-muted uppercase">{label}</span>
            <span className="text-right text-[0.8125rem] sm:text-sm">{children}</span>
        </>
    );
}

export function SiteFooter() {
    const { footer, home } = useIntlayer("site");
    const { locale } = useLocale();

    return (
        <footer className="border-foreground border-t font-mono print:hidden">
            <div className={`${CONTAINER} pt-10 pb-12`}>
                <LocalizedLink
                    aria-label={home.value}
                    className="inline-flex items-center gap-2.5 text-base font-medium"
                    to="/"
                >
                    <LogoMark className="size-6" />
                    outlayr
                </LocalizedLink>
                <nav aria-label={footer.nav.value} className="border-foreground mt-8 border-t">
                    <a className={ROW} href={`mailto:${SUPPORT_EMAIL}`}>
                        <Row label={footer.email}>{SUPPORT_EMAIL}</Row>
                    </a>
                    <LocalizedLink className={ROW} to="/support">
                        <Row label={footer.support}>{footer.supportDetail}</Row>
                    </LocalizedLink>
                    <LocalizedLink className={ROW} to="/terms">
                        <Row label={footer.terms}>
                            {footer.updated({ date: legalDate("terms", LANGUAGES[locale].date) })}
                        </Row>
                    </LocalizedLink>
                    <LocalizedLink className={ROW} to="/privacy">
                        <Row label={footer.privacy}>
                            {footer.updated({ date: legalDate("privacy", LANGUAGES[locale].date) })}
                        </Row>
                    </LocalizedLink>
                </nav>
                <ThemeSwitch />
                <LanguageSwitch />
                <div className="border-foreground flex items-baseline justify-between gap-4 border-t-2 pt-3.5">
                    <span className="text-micro text-muted uppercase">© 2026</span>
                    <span className="text-sm font-medium">{COMPANY}</span>
                </div>
                <p className="text-micro text-muted mt-6">{footer.trademarks}</p>
            </div>
        </footer>
    );
}
