import { HeadContent, Scripts, createRootRoute, useParams } from "@tanstack/react-router";
import { defaultLocale, getIntlayer, getPathWithoutLocale, locales } from "intlayer";
import type { ReactNode } from "react";
import { IntlayerProvider } from "react-intlayer";

import { NotFound } from "@/components/not-found";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { LANGUAGES, localeFromParam, pageUrl } from "@/lib/i18n";
import { ldJson } from "@/lib/seo";
import { COMPANY, SITE_URL, SUPPORT_EMAIL } from "@/lib/site";
import { THEME_SCRIPT } from "@/lib/theme";

import appCss from "../index.css?url";

const ORGANIZATION_ID = `${SITE_URL}/#organization`;

const SITE_GRAPH = {
    "@context": "https://schema.org",
    "@graph": [
        {
            "@id": ORGANIZATION_ID,
            "@type": "Organization",
            email: SUPPORT_EMAIL,
            logo: `${SITE_URL}/apple-touch-icon.png`,
            name: COMPANY,
            url: SITE_URL,
        },
        {
            "@id": `${SITE_URL}/#website`,
            "@type": "WebSite",
            inLanguage: Object.values(LANGUAGES).map((language) => language.lang),
            name: "Outlayr",
            publisher: { "@id": ORGANIZATION_ID },
            url: SITE_URL,
        },
    ],
};

export const Route = createRootRoute({
    head: ({ matches }) => {
        const leaf = matches.at(-1);
        const params: { locale?: string } = leaf?.params ?? {};
        const locale = localeFromParam(params.locale);
        const path = getPathWithoutLocale(leaf?.pathname ?? "/");
        const found = matches.every((match) => match.status === "success" && !match._notFound);
        const { hero, meta } = getIntlayer("home", locale);
        return {
            links: [
                ...(found
                    ? [
                          { href: pageUrl(path, locale), rel: "canonical" },
                          ...locales.map((alternate) => ({
                              href: pageUrl(path, alternate),
                              hrefLang: LANGUAGES[alternate].hreflang,
                              rel: "alternate",
                          })),
                          { href: pageUrl(path, defaultLocale), hrefLang: "x-default", rel: "alternate" },
                      ]
                    : []),
                { href: appCss, rel: "stylesheet" },
                { href: "/favicon.svg", rel: "icon", type: "image/svg+xml" },
                {
                    href: "/favicon-light.png",
                    media: "(prefers-color-scheme: light)",
                    rel: "icon",
                    sizes: "96x96",
                    type: "image/png",
                },
                {
                    href: "/favicon-dark.png",
                    media: "(prefers-color-scheme: dark)",
                    rel: "icon",
                    sizes: "96x96",
                    type: "image/png",
                },
                { href: "/apple-touch-icon.png", rel: "apple-touch-icon" },
            ],
            meta: [
                { charSet: "utf-8" },
                { content: "width=device-width, initial-scale=1", name: "viewport" },
                { content: "#f2f0ea", name: "theme-color" },
                { content: "Outlayr", property: "og:site_name" },
                { content: "website", property: "og:type" },
                { content: LANGUAGES[locale].og, property: "og:locale" },
                ...locales
                    .filter((alternate) => alternate !== locale)
                    .map((alternate) => ({ content: LANGUAGES[alternate].og, property: "og:locale:alternate" })),
                { content: meta.title, property: "og:title" },
                { content: meta.description, property: "og:description" },
                { content: pageUrl(path, locale), property: "og:url" },
                { content: `${SITE_URL}${LANGUAGES[locale].image}`, property: "og:image" },
                { content: "1200", property: "og:image:width" },
                { content: "630", property: "og:image:height" },
                { content: `Outlayr. ${hero.title}`, property: "og:image:alt" },
                { content: "summary_large_image", name: "twitter:card" },
                { content: "app-id=6801652978", name: "apple-itunes-app" },
            ],
            scripts: [{ children: THEME_SCRIPT }, ldJson(SITE_GRAPH)],
        };
    },
    notFoundComponent: NotFound,
    shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
    const locale = localeFromParam(useParams({ strict: false }).locale);
    return (
        <html lang={LANGUAGES[locale].lang} suppressHydrationWarning>
            <head>
                <HeadContent />
            </head>
            <body className="flex min-h-dvh flex-col">
                <IntlayerProvider locale={locale}>
                    <SiteHeader />
                    <div className="flex-1">{children}</div>
                    <SiteFooter />
                </IntlayerProvider>
                <Scripts />
            </body>
        </html>
    );
}
