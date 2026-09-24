import { useEffect, useSyncExternalStore } from "react";
import { useIntlayer } from "react-intlayer";

import { THEMES, chooseTheme, paintTheme, readTheme, subscribeTheme, watchSystemTheme } from "@/lib/theme";

export const SWITCH_ROW =
    "border-border grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-4 border-b py-3.5 sm:grid-cols-[9rem_minmax(0,1fr)]";

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
        <fieldset className={SWITCH_ROW}>
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
                        <span className="text-muted peer-checked:text-foreground peer-checked:decoration-tint peer-focus-visible:outline-tint hover:text-foreground underline-offset-4 transition-colors duration-150 peer-checked:underline peer-checked:decoration-2 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4">
                            {labels[option]}
                        </span>
                    </label>
                ))}
            </div>
        </fieldset>
    );
}
