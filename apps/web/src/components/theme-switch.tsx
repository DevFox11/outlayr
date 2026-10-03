import { useEffect, useSyncExternalStore } from "react";
import { useIntlayer } from "react-intlayer";

import { THEMES, chooseTheme, paintTheme, readTheme, subscribeTheme, watchSystemTheme } from "@/lib/theme";

import { FOOTER_OPTION, FOOTER_ROW } from "./footer-row";

export function ThemeSwitch() {
    const { theme: labels } = useIntlayer("site");
    const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "system");

    useEffect(() => {
        if (theme !== "system") {
            return;
        }
        return watchSystemTheme(() => paintTheme("system"));
    }, [theme]);

    return (
        <fieldset className={FOOTER_ROW}>
            <legend className="sr-only">{labels.label}</legend>
            <span aria-hidden="true" className="text-micro text-muted uppercase">
                {labels.label}
            </span>
            <div className="flex justify-end gap-x-4 text-[0.8125rem] sm:text-sm">
                {THEMES.map((option) => (
                    <label className="cursor-pointer" key={option}>
                        <input
                            checked={theme === option}
                            className="peer sr-only"
                            name="theme"
                            onChange={() => chooseTheme(option)}
                            type="radio"
                            value={option}
                        />
                        <span className={FOOTER_OPTION}>{labels[option]}</span>
                    </label>
                ))}
            </div>
        </fieldset>
    );
}
