import { useEffect, useSyncExternalStore } from "react";
import { useIntlayer } from "react-intlayer";

import { THEMES, chooseTheme, paintTheme, readTheme, subscribeTheme, watchSystemTheme } from "@/lib/theme";

import { SELECT } from "./select";

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
        <label className="relative">
            <span className="sr-only">{labels.label}</span>
            <select
                className={SELECT}
                onChange={(event) => {
                    const choice = THEMES.find((option) => option === event.target.value);
                    if (choice) {
                        chooseTheme(choice);
                    }
                }}
                value={theme}
            >
                {THEMES.map((option) => (
                    <option key={option} value={option}>
                        {labels[option].value}
                    </option>
                ))}
            </select>
        </label>
    );
}
