import { createFileRoute, notFound } from "@tanstack/react-router";
import { validatePrefix } from "intlayer";

export const Route = createFileRoute("/{-$locale}")({
    beforeLoad: ({ params }) => {
        const { isValid, localePrefix } = validatePrefix(params.locale);
        if (!isValid || localePrefix !== params.locale) {
            throw notFound();
        }
    },
});
