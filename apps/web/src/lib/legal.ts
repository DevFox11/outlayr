import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { staticFunctionMiddleware } from "@tanstack/start-static-server-functions";
import { allLegals } from "content-collections";
import type { Legal } from "content-collections";

export const getLegalDocument = createServerFn({ method: "GET" })
    .middleware([staticFunctionMiddleware])
    .inputValidator((input: Pick<Legal, "locale" | "slug">) => input)
    .handler(({ data }) => {
        const document = allLegals.find((entry) => entry.slug === data.slug && entry.locale === data.locale);
        if (!document) {
            throw notFound();
        }
        const { description, intro, mdx, title, toc } = document;
        return { description, intro, mdx, title, toc };
    });
