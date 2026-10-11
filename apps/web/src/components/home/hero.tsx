import { useIntlayer } from "react-intlayer";

import { BudgetCard, InsightsCard } from "@/components/app-ui/app-ui";
import { Icon } from "@/components/icon";
import { StoreBadges } from "@/components/store-badges";
import { CONTAINER } from "@/lib/layout";

import { LoopVideo, Phone } from "./media";

export const HERO_POSTER = { dark: "/screens/log-an-expense-dark.webp", light: "/screens/log-an-expense.webp" };

export function Hero() {
    const { hero } = useIntlayer("home");
    const story = useIntlayer("story");
    return (
        <section className="relative" id="top">
            <div className={`${CONTAINER} grid items-center gap-16 pt-24 pb-24 lg:grid-cols-12`}>
                <div className="mt-8 md:mt-16 lg:col-span-7">
                    <p className="text-muted mb-6 flex items-center gap-2 text-sm" data-reveal>
                        <span className="bg-tint size-2 rounded-sm" />
                        {story.hero.status}
                    </p>
                    <h1
                        className="hero-text max-w-[680px] pb-2 text-5xl font-semibold tracking-tighter delay-100 md:text-7xl"
                        data-reveal
                    >
                        {hero.title}
                    </h1>
                    <p className="text-muted mt-6 max-w-[680px] text-lg delay-200 md:text-xl" data-reveal>
                        {story.hero.lead}
                    </p>
                    <div className="mt-10 delay-300" data-reveal>
                        <StoreBadges placement="hero" />
                    </div>
                    <ul className="text-muted mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm delay-500" data-reveal>
                        {story.hero.proof.map((item) => (
                            <li className="flex items-center gap-2" key={item.value}>
                                <Icon className="text-tint text-base" name="check-circle" />
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="relative mt-8 delay-200 lg:col-span-5 lg:mt-16" data-reveal>
                    <div className="relative mx-auto w-3/5 max-w-80 sm:w-1/2 lg:w-2/3">
                        <Phone className="drop-shadow-[0_32px_48px_rgb(19_18_9/0.3)]">
                            <LoopVideo
                                className="phone-screen bg-app-bg overflow-hidden"
                                label={hero.videoLabel.value}
                                poster={HERO_POSTER}
                                sources={{
                                    dark: "/screens/log-an-expense-dark.mp4",
                                    light: "/screens/log-an-expense.mp4",
                                }}
                            />
                        </Phone>
                        <div className="glass drift absolute top-16 -left-12 w-4/5 rounded-2xl p-2 sm:-left-24">
                            <div className="overflow-hidden rounded-lg">
                                <BudgetCard size="sm" />
                            </div>
                        </div>
                        <div className="glass drift-down absolute -right-12 bottom-24 w-4/5 rounded-2xl p-2 sm:-right-24">
                            <div className="overflow-hidden rounded-lg">
                                <InsightsCard compact size="sm" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
