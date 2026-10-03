import { useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useIntlayer } from "react-intlayer";

import { Screen } from "@/components/screen";
import { CONTAINER } from "@/lib/layout";

import { tabTarget } from "./tab-target";

export function Tour() {
    const { tour, tourLabel } = useIntlayer("home");
    const baseId = useId();
    const tabs = useRef<(HTMLButtonElement | null)[]>([]);
    const [selected, setSelected] = useState(0);

    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        const target = tabTarget(event.key, selected, tour.length);
        if (target === null) {
            return;
        }
        event.preventDefault();
        setSelected(target);
        tabs.current[target]?.focus({ preventScroll: true });
    };

    return (
        <section className="border-border border-t">
            <div className={`${CONTAINER} py-16 md:py-24`}>
                <div
                    aria-label={tourLabel.value}
                    className="border-foreground grid grid-cols-2 border-t sm:grid-cols-4"
                    role="tablist"
                >
                    {tour.map((stop, index) => {
                        const active = index === selected;
                        return (
                            <button
                                aria-controls={`${baseId}-panel-${index}`}
                                aria-selected={active}
                                className={`text-micro cursor-pointer border-b-2 py-3 font-mono uppercase transition-colors duration-150 ease-out ${active ? "border-b-tint text-tint" : "border-b-border text-muted hover:text-foreground"}`}
                                id={`${baseId}-tab-${index}`}
                                key={stop.src.value}
                                onClick={() => setSelected(index)}
                                onKeyDown={onKeyDown}
                                ref={(node) => {
                                    tabs.current[index] = node;
                                }}
                                role="tab"
                                tabIndex={active ? 0 : -1}
                                type="button"
                            >
                                {stop.tab}
                            </button>
                        );
                    })}
                </div>
                {tour.map((stop, index) => (
                    <div
                        aria-labelledby={`${baseId}-tab-${index}`}
                        className="grid gap-10 pt-12 md:grid-cols-2 md:items-start md:gap-x-16 md:pt-16"
                        hidden={index !== selected}
                        id={`${baseId}-panel-${index}`}
                        key={stop.src.value}
                        role="tabpanel"
                        tabIndex={0}
                    >
                        <div>
                            <h2 className="text-title font-bold">{stop.title}</h2>
                            <p className="text-lead text-muted mt-5 max-w-[30rem]">{stop.body}</p>
                            <ol className="border-foreground mt-10 max-w-[30rem] border-t">
                                {stop.notes.map((note, step) => (
                                    <li
                                        className="border-border flex items-start gap-4 border-b py-3.5"
                                        key={note.y.value}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className="bg-tint text-background flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-medium"
                                        >
                                            {step + 1}
                                        </span>
                                        {note.text}
                                    </li>
                                ))}
                            </ol>
                        </div>
                        <Screen
                            alt={stop.alt.value}
                            className="md:justify-self-end"
                            pins={stop.notes.map((note) => note.y.value)}
                            src={stop.src.value}
                        />
                    </div>
                ))}
            </div>
        </section>
    );
}
