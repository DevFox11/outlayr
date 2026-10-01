import { useSyncExternalStore } from "react";
import { useIntlayer } from "react-intlayer";

import { chooseConsent, readConsent, subscribeConsent } from "@/lib/analytics";

import { SWITCH_OPTION, SWITCH_ROW } from "./theme-switch";

export function ConsentSwitch() {
    const { consent: labels } = useIntlayer("site");
    const consent = useSyncExternalStore(subscribeConsent, readConsent, () => null);
    if (consent === null) {
        return null;
    }
    const options = [
        { granted: true, label: labels.allow },
        { granted: false, label: labels.decline },
    ];
    return (
        <fieldset className={SWITCH_ROW}>
            <legend className="sr-only">{labels.label}</legend>
            <span aria-hidden="true" className="text-micro text-muted uppercase">
                {labels.label}
            </span>
            <div className="flex justify-end gap-x-4 text-[0.8125rem] sm:text-sm">
                {options.map(({ granted, label }) => (
                    <label className="cursor-pointer" key={String(granted)}>
                        <input
                            checked={consent === (granted ? "granted" : "denied")}
                            className="peer sr-only"
                            name="cookies"
                            onChange={() => chooseConsent(granted)}
                            type="radio"
                        />
                        <span className={SWITCH_OPTION}>{label}</span>
                    </label>
                ))}
            </div>
        </fieldset>
    );
}
