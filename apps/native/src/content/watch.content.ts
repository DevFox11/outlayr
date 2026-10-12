import { t } from "intlayer";
import type { Dictionary } from "intlayer";

const watch = {
    content: {
        "watch.all": t({
            en: "All",
            es: "Todas",
        }),
        "watch.average": t({
            en: "Avg",
            es: "Prom.",
        }),
        "watch.empty": t({
            en: "Nothing logged yet",
            es: "Nada registrado aún",
        }),
        "watch.recent": t({
            en: "Recent",
            es: "Recientes",
        }),
        "watch.spent": t({
            en: "spent",
            es: "gastado",
        }),
        "watch.week": t({
            en: "Last 7 days",
            es: "Últimos 7 días",
        }),
    },
    key: "watch" as const,
} satisfies Dictionary;

export default watch;
