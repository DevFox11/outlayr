import { Composition } from "remotion";

import { BankShortcut } from "./bank-shortcut";

export function RemotionRoot() {
    return (
        <>
            <Composition
                component={BankShortcut}
                defaultProps={{ lang: "en" as const }}
                durationInFrames={1267}
                fps={30}
                height={1920}
                id="BankShortcut-en"
                width={1080}
            />
            <Composition
                component={BankShortcut}
                defaultProps={{ lang: "es" as const }}
                durationInFrames={1267}
                fps={30}
                height={1920}
                id="BankShortcut-es"
                width={1080}
            />
        </>
    );
}
