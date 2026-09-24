import { useIntlayer, useLocale } from "react-intlayer";

import type { Locale } from "@/lib/i18n";
import { APP_STORE_URL } from "@/lib/site";

const HEIGHT = { large: "h-12", small: "h-10" } as const;

const APP_STORE_BADGE = {
    en: "/badges/app-store.svg",
    es: "/badges/app-store-es.svg",
} as const satisfies Record<Locale, string>;

const GOOGLE_PLAY_BADGE = {
    en: { height: 168, src: "/badges/google-play.png", width: 564 },
    es: { height: 192, src: "/badges/google-play-es.png", width: 646 },
} as const satisfies Record<Locale, { height: number; src: string; width: number }>;

export function AppStoreBadge({ size = "large" }: { size?: keyof typeof HEIGHT }) {
    const { badges } = useIntlayer("site");
    const { locale } = useLocale();
    return (
        <a className="shrink-0" href={APP_STORE_URL}>
            <img
                alt={badges.appStore.value}
                className={`w-auto ${HEIGHT[size]}`}
                height={40}
                src={APP_STORE_BADGE[locale]}
                width={120}
            />
        </a>
    );
}

export function StoreBadges() {
    const { badges } = useIntlayer("site");
    const { locale } = useLocale();
    const googlePlay = GOOGLE_PLAY_BADGE[locale];
    return (
        <div className="flex flex-wrap items-start gap-3 md:shrink-0">
            <AppStoreBadge />
            <figure className="flex shrink-0 flex-col items-center gap-1.5">
                <img
                    alt={badges.googlePlay.value}
                    className="h-12 w-auto"
                    height={googlePlay.height}
                    src={googlePlay.src}
                    width={googlePlay.width}
                />
                <figcaption className="text-micro text-muted font-mono uppercase">{badges.comingSoon}</figcaption>
            </figure>
        </div>
    );
}
