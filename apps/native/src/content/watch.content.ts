import { t } from "intlayer";
import type { Dictionary } from "intlayer";

const watch = {
    content: {
        "watch.empty": t({
            en: "Nothing logged yet",
            es: "Nada registrado aún",
        }),
        "watch.log": t({
            en: "Log",
            es: "Registrar",
        }),
        "watch.logged": t({
            en: "Logged",
            es: "Registrado",
        }),
        "watch.note": t({
            en: "Note",
            es: "Nota",
        }),
        "watch.recent": t({
            en: "Recent",
            es: "Recientes",
        }),
        "watch.spent": t({
            en: "spent",
            es: "gastado",
        }),
    },
    key: "watch" as const,
} satisfies Dictionary;

export default watch;
