import { useDeviceLanguageTag } from "@/i18n/device-language";

export function useLocaleTag(): string | undefined {
    const tag = useDeviceLanguageTag()?.trim();
    return tag || undefined;
}
