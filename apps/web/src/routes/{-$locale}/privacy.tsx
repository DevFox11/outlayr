import { createFileRoute } from "@tanstack/react-router";

import { LegalDocument } from "@/components/legal-document";
import { localeFromParam } from "@/lib/i18n";
import { getLegalDocument } from "@/lib/legal";
import { pageMeta } from "@/lib/seo";

export const Route = createFileRoute("/{-$locale}/privacy")({
    component: Privacy,
    loader: ({ params }) => getLegalDocument({ data: { locale: localeFromParam(params.locale), slug: "privacy" } }),
    head: ({ loaderData }) => ({
        meta: loaderData ? pageMeta(`${loaderData.title} · Outlayr`, loaderData.description) : [],
    }),
});

function Privacy() {
    return <LegalDocument {...Route.useLoaderData()} />;
}
