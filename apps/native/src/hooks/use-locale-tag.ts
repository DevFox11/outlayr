import { useMemo } from "react";
import { deviceLanguageTag } from "@/i18n/language-storage";

export function useLocaleTag(): string | undefined {
	return useMemo(() => {
		try {
			const tag = deviceLanguageTag()?.trim();
			return tag ? tag : undefined;
		} catch {
			return undefined;
		}
	}, []);
}
