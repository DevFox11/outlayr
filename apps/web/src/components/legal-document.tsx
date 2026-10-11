import { MDXContent } from "@content-collections/mdx/react";
import { Link } from "@tanstack/react-router";
import type { Legal } from "content-collections";
import { useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";
import { useIntlayer, useLocale } from "react-intlayer";

import { LANGUAGES } from "@/lib/i18n";
import { legalDate } from "@/lib/site";

import { Icon } from "./icon";
import { ASIDE, COLUMNS, Page } from "./page";

function MdxLink({ children, href = "" }: ComponentProps<"a">) {
    return href.startsWith("/") ? <Link to={href}>{children}</Link> : <a href={href}>{children}</a>;
}

function MdxTable(props: ComponentProps<"table">) {
    return (
        <div>
            <table {...props} />
        </div>
    );
}

const COMPONENTS = { a: MdxLink, table: MdxTable };

function useCurrentClause(toc: Legal["toc"]) {
    const [current, setCurrent] = useState<string>();
    useEffect(() => {
        const passed = new Set<string>();
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        passed.add(entry.target.id);
                    } else {
                        passed.delete(entry.target.id);
                    }
                }
                setCurrent(toc.findLast((entry) => passed.has(entry.id))?.id);
            },
            { rootMargin: "100000px 0px -70% 0px" }
        );
        for (const entry of toc) {
            const heading = document.querySelector(`#${CSS.escape(entry.id)}`);
            if (heading) {
                observer.observe(heading);
            }
        }
        return () => observer.disconnect();
    }, [toc]);
    return current;
}

function Contents({ current, toc }: { current?: string; toc: Legal["toc"] }) {
    return (
        <ol className="flex flex-col gap-0.5">
            {toc.map((entry, index) => (
                <li key={entry.id}>
                    <a
                        aria-current={entry.id === current ? "location" : undefined}
                        className="group fluid text-muted hover:text-foreground aria-[current=location]:bg-raised aria-[current=location]:text-foreground flex gap-3 rounded-2xl px-4 py-2 text-sm"
                        href={`#${entry.id}`}
                    >
                        <span className="tabular group-aria-[current=location]:text-tint w-5 shrink-0 pt-px font-mono text-xs leading-5">
                            {String(index + 1).padStart(2, "0")}
                        </span>
                        <span>{entry.title}</span>
                    </a>
                </li>
            ))}
        </ol>
    );
}

export function LegalDocument({
    intro,
    mdx,
    slug,
    title,
    toc,
}: Pick<Legal, "intro" | "mdx" | "slug" | "title" | "toc">) {
    const { legal } = useIntlayer("site");
    const { locale } = useLocale();
    const current = useCurrentClause(toc);
    const aside = useRef<HTMLElement>(null);

    useEffect(() => {
        const nav = aside.current;
        const link = current ? nav?.querySelector<HTMLElement>(`a[href="#${CSS.escape(current)}"]`) : null;
        if (nav && link) {
            nav.scrollTo({ top: link.offsetTop - (nav.clientHeight - link.offsetHeight) / 2 });
        }
    }, [current]);

    return (
        <Page lead={intro} meta={legal.effective({ date: legalDate(slug, LANGUAGES[locale].date) })} title={title}>
            <details className="group bg-surface mt-12 rounded-3xl lg:hidden print:hidden">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 font-mono text-xs tracking-widest uppercase [&::-webkit-details-marker]:hidden">
                    {legal.contents}
                    <Icon className="fluid text-muted text-base group-open:rotate-90" name="caret-right" />
                </summary>
                <nav aria-label={legal.contents.value} className="px-2 pb-2">
                    <Contents current={current} toc={toc} />
                </nav>
            </details>
            <div className={`${COLUMNS} mt-12 lg:mt-24 print:block`}>
                <nav
                    aria-label={legal.contents.value}
                    className={`${ASIDE} bg-surface max-h-[calc(100dvh-8rem)] overflow-y-auto overscroll-contain rounded-3xl p-2 motion-safe:scroll-smooth max-lg:hidden print:hidden`}
                    ref={aside}
                >
                    <Contents current={current} toc={toc} />
                </nav>
                <div className="legal-body min-w-0">
                    <MDXContent code={mdx} components={COMPONENTS} />
                </div>
            </div>
        </Page>
    );
}
