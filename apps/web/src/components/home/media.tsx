import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useIntlayer, useLocale } from "react-intlayer";

import { Icon } from "@/components/icon";
import { useReducedMotion } from "@/lib/reduced-motion";
import { usePaintedTheme } from "@/lib/theme";

const BEZEL = "/app/iphone.webp";
const AV1 = 'video/mp4; codecs="av01.0.08M.08"';

const VIDEOS = import.meta.glob<string>("/src/assets/videos/*", { eager: true, import: "default" });

export function videoUrl(file: string) {
    const url = VIDEOS[`/src/assets/videos/${file}`];
    if (url === undefined) {
        throw new Error(`Missing video asset: ${file}`);
    }
    return url;
}

export function Phone({ children, className = "" }: { children: ReactNode; className?: string }) {
    return (
        <div className={`phone ${className}`}>
            {children}
            <img alt="" className="phone-bezel" height={2041} src={BEZEL} width={1000} />
        </div>
    );
}

export function Screen({ alt, eager = false, src }: { alt: string; eager?: boolean; src: string }) {
    return (
        <>
            <img
                alt={alt}
                className="phone-screen light-only"
                decoding="async"
                height={1912}
                loading={eager ? "eager" : "lazy"}
                src={src}
                width={880}
            />
            <img
                alt={alt}
                className="phone-screen dark-only"
                decoding="async"
                height={1912}
                loading={eager ? "eager" : "lazy"}
                src={src.replace(/\.webp$/u, "-dark.webp")}
                width={880}
            />
        </>
    );
}

export function useInView<T extends Element>(threshold = 0.3) {
    const ref = useRef<T>(null);
    const [inView, setInView] = useState(false);
    useEffect(() => {
        const node = ref.current;
        if (node === null) {
            return;
        }
        const watcher = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? false), {
            threshold,
        });
        watcher.observe(node);
        return () => watcher.disconnect();
    }, [threshold]);
    return { inView, ref };
}

export function LoopVideo({
    av1,
    className = "relative",
    label,
    lazyPoster = false,
    poster,
    sources,
}: {
    av1?: { dark: string; light: string };
    className?: string;
    label: string;
    /** For a video below the fold: a `poster` attribute is fetched at once, a lazy image only when near. */
    lazyPoster?: boolean;
    poster: { dark: string; light: string };
    sources: { dark: string; light: string };
}) {
    const { pause, play } = useIntlayer("story");
    const reduced = useReducedMotion();
    const theme = usePaintedTheme();
    const { inView, ref } = useInView<HTMLDivElement>(0.3);
    const video = useRef<HTMLVideoElement>(null);
    const [choice, setChoice] = useState<boolean | null>(null);
    const [paused, setPaused] = useState(true);
    const wanted = choice ?? !reduced;
    const playing = wanted && inView;

    useEffect(() => {
        const element = video.current;
        if (element === null || element.dataset.variant !== theme) {
            return;
        }
        if (playing) {
            element.play().catch(() => undefined);
        } else {
            element.pause();
        }
    }, [playing, theme]);

    const toggle = () => {
        setChoice(paused);
        if (paused) {
            video.current?.play().catch(() => undefined);
        } else {
            video.current?.pause();
        }
    };

    return (
        <div className={className} ref={ref}>
            {theme === null || !lazyPoster ? null : (
                <img
                    alt=""
                    className="absolute inset-0 size-full object-cover"
                    decoding="async"
                    height={1080}
                    loading="lazy"
                    src={poster[theme]}
                    width={1080}
                />
            )}
            {theme === null ? null : (
                <video
                    aria-label={label}
                    className={lazyPoster ? "relative size-full object-cover" : "size-full object-cover"}
                    data-variant={theme}
                    height={1080}
                    key={theme}
                    loop
                    muted
                    onPause={() => setPaused(true)}
                    onPlay={() => setPaused(false)}
                    playsInline
                    poster={lazyPoster ? undefined : poster[theme]}
                    preload="none"
                    ref={video}
                    width={1080}
                >
                    {av1 === undefined ? null : <source src={av1[theme]} type={AV1} />}
                    <source src={sources[theme]} type="video/mp4" />
                </video>
            )}
            <button
                aria-label={paused ? play.value : pause.value}
                className="glass fluid absolute right-4 bottom-4 flex size-10 items-center justify-center rounded-full hover:scale-105 active:scale-[0.98]"
                onClick={toggle}
                type="button"
            >
                <Icon name={paused ? "play" : "pause"} />
            </button>
        </div>
    );
}

export function Film({ label, name }: { label: string; name: string }) {
    const { locale } = useLocale();
    const cut = locale === "es" ? "-es" : "";
    return (
        <LoopVideo
            className="bg-surface relative aspect-square"
            lazyPoster
            av1={{ dark: videoUrl(`${name}-dark${cut}.av1.mp4`), light: videoUrl(`${name}-light${cut}.av1.mp4`) }}
            label={label}
            poster={{ dark: videoUrl(`${name}-dark${cut}.webp`), light: videoUrl(`${name}-light${cut}.webp`) }}
            sources={{ dark: videoUrl(`${name}-dark${cut}.mp4`), light: videoUrl(`${name}-light${cut}.mp4`) }}
        />
    );
}

export function Words({ text }: { text: string }) {
    const words = text.split(" ");
    return (
        <>
            {words.map((word, index) => (
                <span data-word key={`${index}-${word}`}>
                    {word}
                    {index < words.length - 1 ? " " : ""}
                </span>
            ))}
        </>
    );
}
