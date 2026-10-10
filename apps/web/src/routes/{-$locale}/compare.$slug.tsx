import { createFileRoute, notFound, rootRouteId } from "@tanstack/react-router";
import { getIntlayer } from "intlayer";
import { useIntlayer, useLocale } from "react-intlayer";

import { HubTrail } from "@/components/hub-trail";
import { StoreBadges } from "@/components/store-badges";
import { hasKey } from "@/lib/has-key";
import { LANGUAGES, localeFromParam } from "@/lib/i18n";
import { CONTAINER } from "@/lib/layout";
import { answerTrail, faqPage, ldJson, pageMeta, webPage } from "@/lib/seo";
import { longDate, rivalChecked } from "@/lib/site";

export const Route = createFileRoute("/{-$locale}/compare/$slug")({
    component: Compare,
    loader: ({ params }) => {
        if (!hasKey(getIntlayer("answers").compare, params.slug)) {
            throw notFound({ routeId: rootRouteId });
        }
        return params.slug;
    },
    head: ({ loaderData, params }) => {
        if (!loaderData) {
            return {};
        }
        const locale = localeFromParam(params.locale);
        const rival = getIntlayer("answers", locale).compare[loaderData];
        return {
            meta: pageMeta(rival.meta.title, rival.lead),
            scripts: [
                ldJson(faqPage(rival.faq, LANGUAGES[locale].lang)),
                ldJson(answerTrail(locale, "compare", loaderData, rival.title)),
                ldJson(
                    webPage(locale, `/compare/${loaderData}`, {
                        dateModified: rivalChecked(loaderData).toISOString().slice(0, 10),
                    })
                ),
            ],
        };
    },
});

function Compare() {
    const slug = Route.useLoaderData();
    const { compare, labels } = useIntlayer("answers");
    const { locale } = useLocale();
    const page = compare[slug];
    const sides = [
        { items: page.fit.outlayr, name: "Outlayr" },
        { items: page.fit.rival, name: page.rival.value },
    ];
    return (
        <main className={`${CONTAINER} pt-10 pb-24 md:pt-16`}>
            <HubTrail hub="/compare" />
            <h1 className="text-display mt-4 max-w-[46rem] font-bold">{page.title}</h1>
            <p className="text-lead text-muted mt-6 max-w-[40rem]">{page.lead}</p>
            <div className="mt-9">
                <StoreBadges placement="answer" />
            </div>
            <table className="mt-14 w-full border-collapse text-left">
                <thead>
                    <tr className="border-foreground border-b">
                        <th className="sr-only" scope="col">
                            {labels.feature}
                        </th>
                        <th className="w-[42%] pr-4 pb-2" scope="col">
                            Outlayr
                        </th>
                        <th className="w-[42%] pb-2" scope="col">
                            {page.rival}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {page.rows.map((row) => (
                        <tr className="border-border border-b align-top" key={row.label.value}>
                            <th className="text-micro text-muted py-3 pr-4 font-mono font-medium uppercase" scope="row">
                                {row.label}
                            </th>
                            <td className="py-3 pr-4">{row.outlayr}</td>
                            <td className="text-muted py-3">{row.rival}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <p className="text-muted mt-4 text-sm">
                {labels.source({ name: page.rival.value })}{" "}
                <a className="hover:text-foreground underline underline-offset-4" href={page.source.value}>
                    {page.site}
                </a>
                {labels.checked({ date: longDate(rivalChecked(slug), LANGUAGES[locale].date) })}
            </p>
            <section className="mt-20">
                <h2 className="text-title font-bold">{labels.fit}</h2>
                <div className="mt-8 grid gap-10 md:grid-cols-2 md:gap-16">
                    {sides.map((side) => (
                        <div key={side.name}>
                            <h3 className="border-foreground border-b pb-2 text-lg font-bold">
                                {labels.fitHeading({ name: side.name })}
                            </h3>
                            <ul>
                                {side.items.map((item) => (
                                    <li className="border-border border-b py-2.5" key={item.value}>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </section>
            <section className="mt-20">
                <h2 className="text-title font-bold">{labels.questions}</h2>
                <div className="border-foreground mt-8 max-w-[40rem] border-t">
                    {page.faq.map((item) => (
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
