import { t } from "intlayer";
import type { Dictionary } from "intlayer";

const language = {
    content: {
        // The row opens Settings rather than changing anything, so the caption has
        // to say where the choice actually lives. It also stops being a half-truth:
        // with no in-app preference, the SwiftUI pickers and the ledger agree.
        "language.footer": t({
            en: "Outlayr follows your device language. Change it in Settings.",
            es: "Outlayr sigue el idioma de tu dispositivo. Cámbialo en Configuración.",
        }),
    },
    key: "language" as const,
} satisfies Dictionary;

export default language;
