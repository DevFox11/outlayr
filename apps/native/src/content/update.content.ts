import { t } from "intlayer";
import type { Dictionary } from "intlayer";

const update = {
    content: {
        "update.failed": t({
            en: "The update did not install. Try again.",
            es: "La actualización no se instaló. Inténtalo de nuevo.",
        }),
        "update.later": t({
            en: "Later",
            es: "Después",
        }),
        "update.meta": t({
            en: "Update · {version} · {date}",
            es: "Actualización · {version} · {date}",
        }),
        "update.now": t({
            en: "Update now",
            es: "Actualizar ahora",
        }),
        "update.title": t({
            en: "What's new",
            es: "Novedades",
        }),
        "update.updating": t({
            en: "Updating, the app restarts when it is done",
            es: "Actualizando, la app se reinicia al terminar",
        }),
    },
    key: "update" as const,
} satisfies Dictionary;

export default update;
