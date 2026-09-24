import type { JSX } from "react";

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
