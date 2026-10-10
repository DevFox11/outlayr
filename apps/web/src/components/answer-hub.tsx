import { Link } from "@tanstack/react-router";
import { getPrefix } from "intlayer";
import type { ReactNode } from "react";
import { useLocale } from "react-intlayer";

import { CONTAINER } from "@/lib/layout";

import { StoreBadges } from "./store-badges";

export function AnswerHub({
    items,
    lead,
    title,
    to,
}: {
    items: readonly { name: ReactNode; slug: string; text: ReactNode }[];
    lead: ReactNode;
    title: ReactNode;
    to: "/{-$locale}/compare/$slug" | "/{-$locale}/guides/$slug";
}) {
    const { locale } = useLocale();
    return (
        <main className={`${CONTAINER} pt-10 pb-24 md:pt-16`}>
            <h1 className="text-display max-w-[46rem] font-bold">{title}</h1>
            <p className="text-lead text-muted mt-6 max-w-[40rem]">{lead}</p>
            <div className="mt-9">
                <StoreBadges placement="answer" />
            </div>
            <ul className="border-foreground mt-14 border-t">
                {items.map((item) => (
                    <li className="border-border border-b" key={item.slug}>
                        <Link
                            className="hover:bg-surface grid gap-1 py-4 transition-colors duration-150 sm:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] sm:items-baseline sm:gap-8"
                            params={{ locale: getPrefix(locale).localePrefix, slug: item.slug }}
                            to={to}
                        >
                            <span className="text-lg font-bold">{item.name}</span>
                            <span className="text-muted">{item.text}</span>
                        </Link>
                    </li>
                ))}
            </ul>
        </main>
    );
}
