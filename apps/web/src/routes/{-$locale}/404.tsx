import { createFileRoute } from "@tanstack/react-router";

import { NotFound } from "@/components/not-found";

export const Route = createFileRoute("/{-$locale}/404")({
    component: NotFound,
    head: () => ({ meta: [{ content: "noindex", name: "robots" }] }),
});
