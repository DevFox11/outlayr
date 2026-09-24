import type { ReactNode } from "react";

import { CONTAINER } from "@/lib/layout";

export const COLUMNS = "grid grid-cols-[minmax(0,36rem)] gap-10 lg:grid-cols-[17rem_minmax(0,36rem)] lg:gap-20";
export const ASIDE = "lg:sticky lg:top-24 lg:self-start";

export function Page({ children, meta, title }: { children: ReactNode; meta?: ReactNode; title: ReactNode }) {
    return (
        <main className={`${CONTAINER} pt-12 pb-24 md:pt-20`}>
            <h1 className="text-title font-bold">{title}</h1>
            {meta ? <p className="text-micro text-muted mt-4 font-mono uppercase">{meta}</p> : null}
            {children}
        </main>
    );
}
