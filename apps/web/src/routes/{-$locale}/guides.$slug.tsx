import { createFileRoute, notFound, rootRouteId } from "@tanstack/react-router";
import { getIntlayer } from "intlayer";
import { useIntlayer } from "react-intlayer";

import { ScanPanel } from "@/components/demo/capture-panels";
import { HubTrail } from "@/components/hub-trail";
import { Screen } from "@/components/screen";
import { AppStoreBadge } from "@/components/store-badges";
import { hasKey } from "@/lib/has-key";
import { LANGUAGES, localeFromParam } from "@/lib/i18n";
import { CONTAINER } from "@/lib/layout";
import { answerTrail, faqPage, ldJson, pageMeta } from "@/lib/seo";

type GuideSlug = keyof ReturnType<typeof getIntlayer<"answers">>["guides"];

const PLATES = {
    "apple-pay-expense-tracker": "/screens/log-an-expense.webp",
    "mint-alternative": "/screens/log-an-expense.webp",
    "multi-currency-expense-tracker": "/screens/06.webp",
    "receipt-scanner": "scan",
    "subscription-tracker": null,
} as const satisfies Record<GuideSlug, string | null>;

const SCAN_SAVED_FRAME = 5;

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
        return {
            meta: pageMeta(guide.meta.title, guide.lead),
            scripts: [
                ldJson(faqPage(guide.faq, LANGUAGES[locale].lang)),
                ldJson(answerTrail(locale, "guides", loaderData, guide.title)),
            ],
        };
    },
});

function GuidePlate({ alt, plate }: { alt: string; plate: string }) {
    if (plate !== "scan") {
        return <Screen alt={alt} eager src={plate} />;
    }
    return (
        <figure className="border-foreground w-full max-w-[22rem] border-t">
            <figcaption className="sr-only">{alt}</figcaption>
            <div aria-hidden="true">
                <ScanPanel frame={SCAN_SAVED_FRAME} />
            </div>
        </figure>
    );
}

function Guide() {
    const slug = Route.useLoaderData();
    const { guides, labels } = useIntlayer("answers");
    const guide = guides[slug];
    const plate = PLATES[slug];
    return (
        <main className={`${CONTAINER} pt-10 pb-24 md:pt-16`}>
            <section className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-center lg:gap-24">
                <div>
                    <HubTrail hub="/guides" />
                    <h1 className="text-display mt-4 font-bold">{guide.title}</h1>
                    <p className="text-lead text-muted mt-6 max-w-[33rem]">{guide.lead}</p>
                    <div className="mt-9">
                        <AppStoreBadge placement="answer" />
                    </div>
                </div>
                {plate !== null && "plateAlt" in guide ? <GuidePlate alt={guide.plateAlt.value} plate={plate} /> : null}
            </section>
            <dl className="border-foreground mt-16 grid border-t lg:grid-cols-2 lg:gap-x-16">
                {guide.facts.map((fact) => (
                    <div
                        className="border-border grid gap-1 border-b py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-baseline sm:gap-4"
                        key={fact.label.value}
                    >
                        <dt className="text-micro text-muted font-mono uppercase">{fact.label}</dt>
                        <dd>{fact.text}</dd>
                    </div>
                ))}
            </dl>
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
