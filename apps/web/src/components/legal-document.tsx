import { MDXContent } from "@content-collections/mdx/react";
import { Link } from "@tanstack/react-router";
import type { Legal } from "content-collections";
import type { ComponentProps } from "react";
import { useIntlayer, useLocale } from "react-intlayer";

import { LANGUAGES } from "@/lib/i18n";
import { legalDate } from "@/lib/site";

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

function Contents({ toc }: { toc: Legal["toc"] }) {
    return (
        <ol className="font-mono text-xs">
            {toc.map((entry, index) => (
                <li className="border-border border-b last:border-b-0" key={entry.id}>
                    <a
                        className="hover:bg-surface flex gap-2.5 py-2.5 transition-colors duration-150 focus-visible:-outline-offset-2 lg:py-1.5"
                        href={`#${entry.id}`}
                    >
                        <span className="text-muted w-5 shrink-0 tabular-nums">{index + 1}</span>
                        <span className="truncate">{entry.title}</span>
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
    return (
        <Page meta={legal.effective({ date: legalDate(slug, LANGUAGES[locale].date) })} title={title}>
            <div className={`${COLUMNS} mt-8 lg:mt-14`}>
                <nav
                    aria-label={legal.contents.value}
                    className={`${ASIDE} border-t-foreground border-b-border hidden max-h-[calc(100dvh-7rem)] overflow-y-auto overscroll-contain border-y lg:block`}
                >
                    <Contents toc={toc} />
                </nav>
                <div>
                    <details className="group border-t-foreground border-b-border border-y lg:hidden print:hidden">
                        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                            <span className="text-micro flex min-h-11 items-center justify-between font-mono uppercase">
                                {legal.contents}
                                <span
                                    aria-hidden="true"
                                    className="text-base transition-transform group-open:rotate-45"
                                >
                                    +
                                </span>
                            </span>
                        </summary>
                        <nav aria-label={legal.contents.value} className="border-border border-t">
                            <Contents toc={toc} />
                        </nav>
                    </details>
                    <div className="legal-body mt-8 lg:mt-0">
                        <p className="text-lead">{intro}</p>
                        <MDXContent code={mdx} components={COMPONENTS} />
                    </div>
                </div>
            </div>
        </Page>
    );
}
