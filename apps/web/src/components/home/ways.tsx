import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useIntlayer } from "react-intlayer";

import { CAPTURE_MODES } from "@/components/demo/capture-panels";
import { useAutoplay } from "@/components/demo/use-autoplay";
import { CONTAINER } from "@/lib/layout";

interface Play {
    frame: number;
    manual: boolean;
    mode: number;
}

const STEP_KEYS = new Map([
    ["ArrowDown", 1],
    ["ArrowLeft", -1],
    ["ArrowRight", 1],
    ["ArrowUp", -1],
]);

function modeAt(index: number) {
    return CAPTURE_MODES[index] ?? CAPTURE_MODES[0];
}

function lastFrame(index: number): number {
    return modeAt(index).durations.length - 1;
}

function advance(play: Play): Play {
    if (play.frame < lastFrame(play.mode)) {
        return { ...play, frame: play.frame + 1 };
    }
    if (play.manual) {
        return play;
    }
    return { frame: 0, manual: false, mode: (play.mode + 1) % CAPTURE_MODES.length };
}

export function Ways() {
    const { modes, ways } = useIntlayer("demo");
    const root = useRef<HTMLElement>(null);
    const tabs = useRef<(HTMLButtonElement | null)[]>([]);
    const baseId = useId();
    const panelId = `${baseId}-panel`;
    const { reduced, running } = useAutoplay(root);
    const [play, setPlay] = useState<Play>({ frame: lastFrame(0), manual: false, mode: 0 });
    const current = modeAt(play.mode);
    const finished = play.frame >= lastFrame(play.mode);
    const live = running && !(play.manual && finished);
    const tick = useEffectEvent(() => setPlay(advance));

    useEffect(() => {
        if (!live) {
            return;
        }
        const timer = window.setTimeout(tick, current.durations[play.frame] ?? 0);
        return () => window.clearTimeout(timer);
    }, [current, live, play]);

    const select = (mode: number) => setPlay({ frame: 0, manual: true, mode });

    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        const count = CAPTURE_MODES.length;
        let target: number | null = null;
        const step = STEP_KEYS.get(event.key);
        if (step !== undefined) {
            target = (play.mode + step + count) % count;
        } else if (event.key === "Home") {
            target = 0;
        } else if (event.key === "End") {
            target = count - 1;
        }
        if (target === null) {
            return;
        }
        event.preventDefault();
        select(target);
        tabs.current[target]?.focus({ preventScroll: true });
    };

    const { Panel } = current;

    return (
        <section
            className={`${CONTAINER} grid gap-8 py-20 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:items-start md:gap-12 md:py-28 lg:gap-20`}
            ref={root}
        >
            <div>
                <h2 className="text-title font-bold">{ways.title}</h2>
                <p className="text-lead text-muted mt-5 max-w-[30rem]">{ways.lead}</p>
                <div
                    aria-label={ways.tabs.value}
                    aria-orientation="vertical"
                    className="border-foreground mt-10 grid max-w-[34rem] grid-cols-4 border-t md:block"
                    onFocus={() => setPlay((state) => (state.manual ? state : { ...state, manual: true }))}
                    role="tablist"
                >
                    {CAPTURE_MODES.map((mode, index) => {
                        const selected = index === play.mode;
                        return (
                            <button
                                aria-controls={panelId}
                                aria-selected={selected}
                                className={`cursor-pointer border-b-2 py-3 transition-colors duration-150 ease-out md:grid md:w-full md:grid-cols-[5.5rem_minmax(0,1fr)] md:gap-4 md:border-b md:border-l-2 md:py-4 md:pl-3 md:text-left ${selected ? "border-b-tint md:border-b-border md:border-l-tint" : "border-b-border text-muted hover:text-foreground md:border-l-background"}`}
                                id={`${baseId}-tab-${index}`}
                                key={mode.id}
                                onClick={() => select(index)}
                                onKeyDown={onKeyDown}
                                ref={(node) => {
                                    tabs.current[index] = node;
                                }}
                                role="tab"
                                tabIndex={selected ? 0 : -1}
                                type="button"
                            >
                                <span
                                    className={`text-micro font-mono uppercase md:pt-1 ${selected ? "text-tint" : ""}`}
                                >
                                    {modes[mode.id].label}
                                </span>
                                <span className="hidden md:block">{modes[mode.id].text}</span>
                            </button>
                        );
                    })}
                </div>
                <p className="mt-4 md:hidden">{modes[current.id].text}</p>
            </div>
            <div
                aria-labelledby={`${baseId}-tab-${play.mode}`}
                className="border-foreground border-t"
                id={panelId}
                role="tabpanel"
                tabIndex={0}
            >
                <Panel frame={reduced ? lastFrame(play.mode) : play.frame} />
            </div>
        </section>
    );
}
