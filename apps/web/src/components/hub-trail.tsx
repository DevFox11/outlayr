import { useIntlayer } from "react-intlayer";

import { LocalizedLink } from "./localized-link";

export function HubTrail({ hub }: { hub: "/compare" | "/guides" }) {
    const { footer } = useIntlayer("site");
    return (
        <LocalizedLink
            className="text-micro text-muted hover:text-foreground font-mono uppercase transition-colors duration-150"
            to={hub}
        >
            {hub === "/guides" ? footer.guides : footer.compare}
        </LocalizedLink>
    );
}
