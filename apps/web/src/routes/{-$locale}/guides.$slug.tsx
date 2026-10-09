import { Link, createFileRoute, notFound, rootRouteId } from "@tanstack/react-router";
import { getIntlayer, getPrefix } from "intlayer";
import type { ReactNode } from "react";
import { useIntlayer, useLocale } from "react-intlayer";

import { SayPanel, ScanPanel } from "@/components/demo/capture-panels";
import { HubTrail } from "@/components/hub-trail";
import { Screen } from "@/components/screen";
import { AppStoreBadge } from "@/components/store-badges";
import { hasKey } from "@/lib/has-key";
import { LANGUAGES, localeFromParam, pageUrl } from "@/lib/i18n";
import { CONTAINER } from "@/lib/layout";
import { answerTrail, faqPage, itemList, ldJson, pageMeta, webPage } from "@/lib/seo";
import { longDate } from "@/lib/site";

type GuideSlug = keyof ReturnType<typeof getIntlayer<"answers">>["guides"];

const PLATES = {
    "apple-pay-expense-tracker": "/screens/log-an-expense.webp",
    "best-expense-tracker-apps": null,
    "best-subscription-tracker-apps": null,
    "budget-planner": "/screens/04.webp",
    "expense-tracker-template": null,
    "mint-alternative": "/screens/log-an-expense.webp",
    "multi-currency-expense-tracker": "/screens/06.webp",
    "receipt-scanner": "scan",
    "subscription-tracker": "/screens/10.webp",
    "voice-expense-tracker": "say",
} as const satisfies Record<GuideSlug, string | null>;

const PANELS = {
    say: { frame: 5, Panel: SayPanel },
    scan: { frame: 5, Panel: ScanPanel },
} as const;

const LISTS_CHECKED = new Date(Date.UTC(2026, 9, 9));

const WWW = /^www\./u;

export const Route = createFileRoute("/{-$locale}/guides/$slug")({
    component: Guide,
    loader: ({ params }) => {
        if (!hasKey(getIntlayer("answers").guides, params.slug)) {
            throw notFound({ routeId: rootRouteId });
        }
        return params.slug;
    },
    head: ({ loaderData, params }) => {
        if (!loaderData) {
            return {};
        }
        const locale = localeFromParam(params.locale);
        const guide = getIntlayer("answers", locale).guides[loaderData];
        const url = pageUrl(`/guides/${loaderData}`, locale);
        return {
            meta: pageMeta(guide.meta.title, guide.lead),
            scripts: [
                ldJson(faqPage(guide.faq, LANGUAGES[locale].lang)),
                ldJson(answerTrail(locale, "guides", loaderData, guide.title)),
                ...("apps" in guide
                    ? [
                          ldJson(itemList(guide.apps.map((app) => ({ name: app.name, url: `${url}#${app.slug}` })))),
                          ldJson(
                              webPage(locale, `/guides/${loaderData}`, {
                                  dateModified: LISTS_CHECKED.toISOString().slice(0, 10),
                              })
                          ),
                      ]
                    : []),
            ],
        };
    },
});

function GuidePlate({ alt, plate }: { alt: string; plate: string }) {
    if (!hasKey(PANELS, plate)) {
        return <Screen alt={alt} eager src={plate} />;
    }
    const { frame, Panel } = PANELS[plate];
    return (
        <figure className="border-foreground w-full max-w-[22rem] border-t">
            <figcaption className="sr-only">{alt}</figcaption>
            <div aria-hidden="true">
                <Panel frame={frame} />
            </div>
        </figure>
    );
}

function FactList({
    className,
    facts,
}: {
    className: string;
    facts: readonly { key: string; label: ReactNode; source?: string; text: ReactNode }[];
}) {
    return (
        <dl className={`border-foreground grid border-t lg:grid-cols-2 lg:gap-x-16 ${className}`}>
            {facts.map((fact) => (
                <div
                    className="border-border grid gap-1 border-b py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-baseline sm:gap-4"
                    key={fact.key}
                >
                    <dt className="text-micro text-muted font-mono uppercase">{fact.label}</dt>
                    <dd>
                        {fact.text}
                        {fact.source === undefined ? null : (
                            <>
                                {" "}
                                <a
                                    className="text-muted hover:text-foreground text-sm whitespace-nowrap underline underline-offset-4"
                                    href={fact.source}
                                >
                                    {new URL(fact.source).hostname.replace(WWW, "")}
                                </a>
                            </>
                        )}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

function Guide() {
    const slug = Route.useLoaderData();
    const { compare, guides, labels } = useIntlayer("answers");
    const { locale } = useLocale();
    const guide = guides[slug];
    const plate = PLATES[slug];
    return (
        <main className={`${CONTAINER} pt-10 pb-24 md:pt-16`}>
            <section className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-center lg:gap-24">
                <div>
                    <HubTrail hub="/guides" />
                    <h1 className="text-display mt-4 font-bold">{guide.title}</h1>
                    <p className="text-lead text-muted mt-6 max-w-[33rem]">{guide.lead}</p>
                    {"download" in guide ? (
                        <a
                            className="text-tint mt-6 inline-block font-medium underline underline-offset-4"
                            download
                            href={guide.download.href.value}
                        >
                            {guide.download.label}
                        </a>
                    ) : null}
                    <div className="mt-9">
                        <AppStoreBadge placement="answer" />
                    </div>
                </div>
                {plate !== null && "plateAlt" in guide ? <GuidePlate alt={guide.plateAlt.value} plate={plate} /> : null}
            </section>
            <FactList
                className="mt-16"
                facts={guide.facts.map((fact) => ({ key: fact.label.value, label: fact.label, text: fact.text }))}
            />
            {"apps" in guide ? (
                <>
                    <p className="text-muted mt-4 text-sm">
                        {guide.sources}
                        {labels.checked({ date: longDate(LISTS_CHECKED, LANGUAGES[locale].date) })}
                    </p>
                    {guide.apps.map((app) => (
                        <section className="mt-16 scroll-mt-8" id={app.slug.value} key={app.slug.value}>
                            <h2 className="text-title font-bold">{app.name}</h2>
                            <p className="text-muted mt-2 max-w-[40rem]">{app.summary}</p>
                            <FactList
                                className="mt-6"
                                facts={app.facts.map((fact) => ({
                                    key: fact.label.value,
                                    label: fact.label,
                                    source: "source" in fact ? fact.source.value : undefined,
                                    text: fact.text,
                                }))}
                            />
                            {hasKey(compare, app.slug.value) ? (
                                <Link
                                    className="hover:text-foreground text-muted mt-4 inline-block text-sm underline underline-offset-4"
                                    params={{ locale: getPrefix(locale).localePrefix, slug: app.slug.value }}
                                    to="/{-$locale}/compare/$slug"
                                >
                                    {compare[app.slug.value].title}
                                </Link>
                            ) : null}
                        </section>
                    ))}
                </>
            ) : null}
            {"steps" in guide ? (
                <section className="mt-20">
                    <h2 className="text-title font-bold">{labels.steps}</h2>
                    <ol className="mt-8 grid gap-8 md:grid-cols-3 md:gap-12">
                        {guide.steps.map((step, index) => (
                            <li key={step.title.value}>
                                <span aria-hidden="true" className="text-tint font-mono text-sm font-medium">
                                    {index + 1}
                                </span>
                                <h3 className="mt-2 text-lg font-bold">{step.title}</h3>
                                <p className="text-muted mt-1">{step.text}</p>
                            </li>
                        ))}
                    </ol>
                </section>
            ) : null}
            <section className="mt-20">
                <h2 className="text-title font-bold">{labels.questions}</h2>
                <div className="border-foreground mt-8 max-w-[40rem] border-t">
                    {guide.faq.map((item) => (
                        <div className="border-border border-b py-6" key={item.question.value}>
                            <h3 className="text-lg font-bold">{item.question}</h3>
                            <p className="text-muted mt-2 leading-relaxed">{item.answer}</p>
                        </div>
                    ))}
                </div>
            </section>
        </main>
    );
}
