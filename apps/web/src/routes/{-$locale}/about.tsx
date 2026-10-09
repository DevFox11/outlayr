import { createFileRoute } from "@tanstack/react-router";
import { getIntlayer } from "intlayer";
import type { ReactNode } from "react";
import { useIntlayer } from "react-intlayer";

import { LocalizedLink } from "@/components/localized-link";
import { Page } from "@/components/page";
import { LANGUAGES, localeFromParam } from "@/lib/i18n";
import { ORGANIZATION_ID, ldJson, pageMeta, webPage } from "@/lib/seo";
import { APP_STORE_URL, SITE_URL, SUPPORT_EMAIL } from "@/lib/site";

const LINK = "underline underline-offset-4";

export const Route = createFileRoute("/{-$locale}/about")({
    component: About,
    head: ({ params }) => {
        const locale = localeFromParam(params.locale);
        const { entity, meta } = getIntlayer("about", locale);
        return {
            meta: pageMeta(meta.title, meta.description),
            scripts: [
                ldJson(
                    webPage(locale, "/about", {
                        "@type": "AboutPage",
                        about: { "@id": ORGANIZATION_ID },
                        mainEntity: {
                            "@id": `${SITE_URL}/#app`,
                            "@type": "MobileApplication",
                            applicationCategory: "FinanceApplication",
                            description: entity,
                            downloadUrl: APP_STORE_URL,
                            inLanguage: Object.values(LANGUAGES).map((language) => language.lang),
                            name: "Outlayr",
                            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
                            operatingSystem: "iOS 18.0",
                            publisher: { "@id": ORGANIZATION_ID },
                        },
                        name: meta.title,
                    })
                ),
            ],
        };
    },
});

function Fact({ children, label }: { children: ReactNode; label: ReactNode }) {
    return (
        <div className="border-border grid gap-1 border-b py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-baseline sm:gap-4">
            <dt className="text-micro text-muted font-mono uppercase">{label}</dt>
            <dd>{children}</dd>
        </div>
    );
}

function About() {
    const { allComparisons, allGuides, appIcon, entity, facts, press, title } = useIntlayer("about");
    const { footer } = useIntlayer("site");
    const { tour } = useIntlayer("home");
    return (
        <Page title={title}>
            <p className="text-lead text-muted mt-6 max-w-[40rem]">{entity}</p>
            <dl className="border-foreground mt-12 grid border-t lg:grid-cols-2 lg:gap-x-16">
                {facts.map((fact) => (
                    <Fact key={fact.label.value} label={fact.label}>
                        {fact.text}
                    </Fact>
                ))}
                <Fact label={footer.email}>
                    <a className={LINK} href={`mailto:${SUPPORT_EMAIL}`}>
                        {SUPPORT_EMAIL}
                    </a>
                </Fact>
                <Fact label={footer.guides}>
                    <LocalizedLink className={LINK} to="/guides">
                        {allGuides}
                    </LocalizedLink>
                </Fact>
                <Fact label={footer.compare}>
                    <LocalizedLink className={LINK} to="/compare">
                        {allComparisons}
                    </LocalizedLink>
                </Fact>
                <Fact label={press}>
                    <span className="flex flex-wrap gap-x-4 gap-y-1">
                        <a className={LINK} href="/apple-touch-icon.png">
                            {appIcon}
                        </a>
                        {tour.map((stop) => (
                            <a className={LINK} href={stop.src.value} key={stop.src.value}>
                                {stop.tab}
                            </a>
                        ))}
                    </span>
                </Fact>
            </dl>
        </Page>
    );
}
