import { getIntlayer } from "intlayer";
import type { JSX } from "react";

import { pageUrl } from "./i18n";
import type { Locale } from "./i18n";

type Json = string | number | boolean | null | readonly Json[] | { readonly [key: string]: Json | undefined };

export function pageMeta(title: string, description: string): JSX.IntrinsicElements["meta"][] {
    return [
        { title },
        { content: description, name: "description" },
        { content: title, property: "og:title" },
        { content: description, property: "og:description" },
    ];
}

export function faqPage(items: readonly { answer: string; question: string }[], inLanguage: string) {
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        inLanguage,
        mainEntity: items.map((item) => ({
            "@type": "Question",
            acceptedAnswer: { "@type": "Answer", text: item.answer },
            name: item.question,
        })),
    };
}

export function ldJson(data: Json) {
    return { children: JSON.stringify(data).replaceAll("<", "\\u003c"), type: "application/ld+json" };
}

const TRAILING_PERIOD = /\.$/u;

export function answerTrail(locale: Locale, hub: "compare" | "guides", slug: string, title: string) {
    const crumbs = [
        { name: "Outlayr", url: pageUrl("/", locale) },
        { name: getIntlayer("site", locale).footer[hub], url: pageUrl(`/${hub}`, locale) },
        { name: title.replace(TRAILING_PERIOD, ""), url: pageUrl(`/${hub}/${slug}`, locale) },
    ];
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: crumbs.map((crumb, index) => ({
            "@type": "ListItem",
            item: crumb.url,
            name: crumb.name,
            position: index + 1,
        })),
    };
}

export function itemList(items: readonly { name: string; url: string }[]) {
    return {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: items.map((item, index) => ({
            "@type": "ListItem",
            name: item.name,
            position: index + 1,
            url: item.url,
        })),
    };
}
