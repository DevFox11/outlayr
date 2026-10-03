import { createFileRoute } from "@tanstack/react-router";
import { getIntlayer } from "intlayer";
import { useEffect, useRef, useState } from "react";
import { useIntlayer } from "react-intlayer";

import { Plate } from "@/components/home/plate";
import { Ways } from "@/components/home/ways";
import { Screen } from "@/components/screen";
import { StoreBadges } from "@/components/store-badges";
import { LANGUAGES, localeFromParam } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { CONTAINER } from "@/lib/layout";
import { useReducedMotion } from "@/lib/reduced-motion";
import { faqPage, ldJson, pageMeta } from "@/lib/seo";
import { COMPANY, SITE_URL } from "@/lib/site";

const POSTER = "/screens/log-an-expense.webp";
const DARK_POSTER = "/screens/log-an-expense-dark.webp";

type Home = ReturnType<typeof useIntlayer<"home">>;

function appGraph(locale: Locale) {
    const { extras, meta } = getIntlayer("home", locale);
    return {
        "@context": "https://schema.org",
        "@id": `${SITE_URL}/#app`,
        "@type": "MobileApplication",
        applicationCategory: "FinanceApplication",
        description: meta.description,
        featureList: extras.map((extra) => extra.label),
        image: `${SITE_URL}${LANGUAGES[locale].image}`,
        inLanguage: Object.values(LANGUAGES).map((language) => language.lang),
        name: "Outlayr",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        operatingSystem: "iOS 18.0",
        publisher: { "@id": `${SITE_URL}/#organization`, "@type": "Organization", name: COMPANY },
        url: SITE_URL,
    };
}

export const Route = createFileRoute("/{-$locale}/")({
    component: HomePage,
    head: ({ params }) => {
        const locale = localeFromParam(params.locale);
        const { faq, meta } = getIntlayer("home", locale);
        return {
            links: [
                {
                    as: "image",
                    fetchPriority: "high",
                    href: POSTER,
                    media: "(prefers-color-scheme: light)",
                    rel: "preload",
                    type: "image/webp",
                },
                {
                    as: "image",
                    fetchPriority: "high",
                    href: DARK_POSTER,
                    media: "(prefers-color-scheme: dark)",
                    rel: "preload",
                    type: "image/webp",
                },
            ],
            meta: pageMeta(meta.title, meta.description),
            scripts: [ldJson(appGraph(locale)), ldJson(faqPage(faq, LANGUAGES[locale].lang))],
        };
    },
});

function HomePage() {
    const { tour } = useIntlayer("home");
    return (
        <main>
            <Hero />
            <Plate />
            <Ways />
            {tour.map((stop, index) => (
                <TourStop flip={index % 2 === 0} key={stop.src.value} stop={stop} />
            ))}
            <Extras />
            <Plans />
            <Questions />
            <Closing />
        </main>
    );
}

function Hero() {
    const { facts, hero } = useIntlayer("home");
    return (
        <section
            className={`${CONTAINER} grid gap-12 pt-10 pb-20 md:pt-16 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-center lg:gap-24`}
        >
            <div>
                <h1 className="text-display font-bold">{hero.title}</h1>
                <p className="text-lead text-muted mt-6 max-w-[33rem]">{hero.lead}</p>
                <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
                    <StoreBadges placement="hero" />
                    <a className="font-semibold whitespace-nowrap underline underline-offset-4" href="#plans">
                        {hero.secondary}
                    </a>
                </div>
                <dl className="border-foreground mt-10 grid max-w-[33rem] border-t sm:mt-14 sm:grid-cols-3">
                    {facts.map((fact) => (
                        <div
                            className="border-border grid grid-cols-[6rem_minmax(0,1fr)] items-baseline gap-4 border-b py-2.5 sm:block sm:border-b-0 sm:border-l sm:py-3 sm:pl-3 sm:first:border-l-0 sm:first:pl-0"
                            key={fact.label.value}
                        >
                            <dt className="text-micro text-muted font-mono uppercase">{fact.label}</dt>
                            <dd className="text-sm sm:mt-1">{fact.value}</dd>
                        </div>
                    ))}
                </dl>
            </div>
            <DemoVideo />
        </section>
    );
}

const VIDEOS = [
    { className: "light-only", poster: POSTER, src: "/screens/log-an-expense.mp4" },
    { className: "dark-only", poster: DARK_POSTER, src: "/screens/log-an-expense-dark.mp4" },
] as const;

function DemoVideo() {
    const { hero } = useIntlayer("home");
    const videos = useRef<HTMLVideoElement[]>([]);
    const reduced = useReducedMotion();
    const [choice, setChoice] = useState<boolean | null>(null);
    const playing = choice ?? !reduced;

    useEffect(() => {
        const sync = () => {
            for (const video of videos.current) {
                if (playing && video.offsetParent !== null) {
                    video.play().catch(() => undefined);
                } else {
                    video.pause();
                }
            }
        };
        sync();
        const observer = new MutationObserver(sync);
        observer.observe(document.documentElement, { attributeFilter: ["data-theme"] });
        return () => observer.disconnect();
    }, [playing]);

    return (
        <figure className="w-full max-w-[22rem] lg:max-w-none">
            {VIDEOS.map((video, index) => (
                <video
                    aria-label={hero.videoLabel.value}
                    className={`screen ${video.className}`}
                    height={1564}
                    key={video.src}
                    loop
                    muted
                    playsInline
                    poster={video.poster}
                    preload="none"
                    ref={(element) => {
                        if (element) {
                            videos.current[index] = element;
                        }
                    }}
                    src={video.src}
                    width={720}
                />
            ))}
            <figcaption className="text-micro text-muted mt-3 flex items-baseline justify-between gap-4 font-mono uppercase">
                {hero.videoCaption}
                <button
                    className="hover:text-foreground uppercase transition-colors duration-150"
                    onClick={() => setChoice(!playing)}
                    type="button"
                >
                    {playing ? hero.pauseVideo : hero.playVideo}
                </button>
            </figcaption>
        </figure>
    );
}

function TourStop({ flip, stop }: { flip: boolean; stop: Home["tour"][number] }) {
    return (
        <section className="border-border border-t">
            <div className={`${CONTAINER} grid gap-10 py-16 md:grid-cols-2 md:items-center md:gap-x-16 md:py-20`}>
                <div className={flip ? "md:order-2" : ""}>
                    <h2 className="text-title font-bold">{stop.title}</h2>
                    <p className="text-lead text-muted mt-5 max-w-[30rem]">{stop.body}</p>
                    <ol className="border-foreground mt-10 max-w-[30rem] border-t">
                        {stop.notes.map((note, index) => (
                            <li className="border-border flex items-start gap-4 border-b py-3.5" key={note.y.value}>
                                <span
                                    aria-hidden="true"
                                    className="bg-tint text-background flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-medium"
                                >
                                    {index + 1}
                                </span>
                                {note.text}
                            </li>
                        ))}
                    </ol>
                </div>
                <Screen
                    alt={stop.alt.value}
                    className={flip ? "" : "md:justify-self-end"}
                    pins={stop.notes.map((note) => note.y.value)}
                    side={flip ? "right" : "left"}
                    src={stop.src.value}
                />
            </div>
        </section>
    );
}

function Extras() {
    const { extras, extrasTitle } = useIntlayer("home");
    return (
        <section className="border-foreground border-t">
            <div className={`${CONTAINER} py-14 md:py-16`}>
                <h2 className="text-title font-bold">{extrasTitle}</h2>
                <dl className="border-foreground mt-8 grid border-t lg:grid-cols-2 lg:gap-x-16">
                    {extras.map((extra) => (
                        <div
                            className="border-border grid gap-1 border-b py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-baseline sm:gap-4"
                            key={extra.label.value}
                        >
                            <dt className="text-micro text-muted font-mono uppercase">{extra.label}</dt>
                            <dd>{extra.text}</dd>
                        </div>
                    ))}
                </dl>
            </div>
        </section>
    );
}

function Plans() {
    const { plans, plansCopy } = useIntlayer("home");
    return (
        <section className="bg-surface border-border scroll-mt-16 border-t" id="plans">
            <div className={`${CONTAINER} grid gap-10 py-20 md:py-28 lg:grid-cols-2 lg:gap-x-16`}>
                <div>
                    <h2 className="text-title font-bold">{plansCopy.title}</h2>
                    <p className="text-lead text-muted mt-5 max-w-[30rem]">{plansCopy.lead}</p>
                </div>
                <div>
                    <table className="w-full border-collapse text-left">
                        <thead>
                            <tr className="border-foreground border-b">
                                <th className="sr-only" scope="col">
                                    {plansCopy.feature}
                                </th>
                                <th
                                    className="text-micro text-muted w-12 pb-2 text-right font-mono uppercase sm:w-16"
                                    scope="col"
                                >
                                    {plansCopy.free}
                                </th>
                                <th className="text-micro w-20 pb-2 text-right font-mono uppercase sm:w-24" scope="col">
                                    {plansCopy.pro}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {plans.map((plan) => (
                                <tr className="border-border border-b" key={plan.label.value}>
                                    <th className="py-2.5 pr-3 font-normal sm:pr-4" scope="row">
                                        {plan.label}
                                    </th>
                                    <td className="text-muted py-2.5 pl-3 text-right font-mono text-sm tabular-nums">
                                        {plan.free}
                                    </td>
                                    <td className="text-income py-2.5 pl-3 text-right font-mono text-sm tabular-nums">
                                        {plan.pro}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p className="text-muted mt-6 max-w-[34rem] text-sm">{plansCopy.footnote}</p>
                </div>
            </div>
        </section>
    );
}

function Questions() {
    const { faq, faqTitle } = useIntlayer("home");
    return (
        <section className="border-foreground border-t" id="faq">
            <div
                className={`${CONTAINER} grid gap-10 py-20 md:grid-cols-[minmax(0,1fr)_minmax(0,40rem)] md:gap-16 md:py-28`}
            >
                <h2 className="text-title font-bold">{faqTitle}</h2>
                <div className="border-foreground border-t">
                    {faq.map((item) => (
                        <div className="border-border border-b py-6" key={item.question.value}>
                            <h3 className="text-lg font-bold">{item.question}</h3>
                            <p className="text-muted mt-2 leading-relaxed">{item.answer}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

function Closing() {
    const { closingTitle } = useIntlayer("home");
    return (
        <section className="border-foreground border-t">
            <div
                className={`${CONTAINER} flex flex-col gap-10 pt-20 pb-24 md:flex-row md:items-baseline-last md:justify-between md:gap-16 md:pt-32 md:pb-36`}
            >
                <h2 className="text-poster max-w-[12em] font-bold">{closingTitle}</h2>
                <StoreBadges placement="closing" />
            </div>
        </section>
    );
}
