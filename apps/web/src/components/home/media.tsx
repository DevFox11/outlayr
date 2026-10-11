import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useIntlayer, useLocale } from "react-intlayer";

import { Icon } from "@/components/icon";
import { useReducedMotion } from "@/lib/reduced-motion";
import { usePaintedTheme } from "@/lib/theme";

const BEZEL = "/app/iphone.webp";

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
    className = "relative",
    label,
    poster,
    sources,
}: {
    className?: string;
    label: string;
    poster: { dark: string; light: string };
    sources: { dark: string; light: string };
}) {
    const { pause, play } = useIntlayer("story");
    const reduced = useReducedMotion();
    const theme = usePaintedTheme();
    const { inView, ref } = useInView<HTMLDivElement>(0.3);
    const video = useRef<HTMLVideoElement>(null);
    const [choice, setChoice] = useState<boolean | null>(null);
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

    return (
        <div className={className} ref={ref}>
            {theme === null ? null : (
                <video
                    aria-label={label}
                    className="size-full object-cover"
                    data-variant={theme}
                    height={1080}
                    key={theme}
                    loop
                    muted
                    playsInline
                    poster={poster[theme]}
                    preload="none"
                    ref={video}
                    src={sources[theme]}
                    width={1080}
                />
            )}
            <button
                aria-label={wanted ? pause.value : play.value}
                className="glass fluid absolute right-4 bottom-4 flex size-10 items-center justify-center rounded-full hover:scale-105 active:scale-[0.98]"
                onClick={() => setChoice(!wanted)}
                type="button"
            >
                <Icon name={wanted ? "pause" : "play"} />
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
            label={label}
            poster={{ dark: `/videos/${name}-dark${cut}.webp`, light: `/videos/${name}-light${cut}.webp` }}
            sources={{ dark: `/videos/${name}-dark${cut}.mp4`, light: `/videos/${name}-light${cut}.mp4` }}
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
