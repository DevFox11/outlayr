import { createFileRoute } from "@tanstack/react-router";
import { getIntlayer } from "intlayer";
import { posthog } from "posthog-js";
import { useIntlayer } from "react-intlayer";

import { ASIDE, COLUMNS, Page } from "@/components/page";
import { LANGUAGES, localeFromParam } from "@/lib/i18n";
import { faqPage, ldJson, pageMeta } from "@/lib/seo";
import { SUPPORT_EMAIL } from "@/lib/site";

export const Route = createFileRoute("/{-$locale}/support")({
    component: Support,
    head: ({ params }) => {
        const locale = localeFromParam(params.locale);
        const { answers, meta } = getIntlayer("support", locale);
        return {
            meta: pageMeta(meta.title, meta.description),
            scripts: [ldJson(faqPage(answers, LANGUAGES[locale].lang))],
        };
    },
});

function Support() {
    const { answers, intro, title } = useIntlayer("support");
    return (
        <Page title={title}>
            <div className={`${COLUMNS} mt-6 lg:mt-14`}>
                <div className={ASIDE}>
                    <p className="text-lead text-muted">{intro}</p>
                    <a
                        className="mt-5 inline-block font-mono font-medium whitespace-nowrap underline underline-offset-4"
                        href={`mailto:${SUPPORT_EMAIL}`}
                        onClick={() => posthog.capture("support_email_clicked")}
                    >
                        {SUPPORT_EMAIL}
                    </a>
                </div>
                <div className="border-foreground border-t">
                    {answers.map((item) => (
                        <div className="border-border border-b py-6" key={item.question.value}>
                            <h2 className="text-lg font-bold">{item.question}</h2>
                            <p className="text-muted mt-2 leading-relaxed">{item.answer}</p>
                        </div>
                    ))}
                </div>
            </div>
        </Page>
    );
}
