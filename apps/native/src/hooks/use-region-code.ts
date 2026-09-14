import { useMemo } from "react";

import { firstLocale } from "@/i18n/device-language";

export function useRegionCode(): string | undefined {
    return useMemo(() => firstLocale()?.regionCode?.trim() || undefined, []);
}
