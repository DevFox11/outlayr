import { getLocales } from "expo-localization";
import { useMemo } from "react";

export function useRegionCode(): string | undefined {
	return useMemo(() => {
		try {
			const region = getLocales()[0]?.regionCode?.trim();
			return region ? region : undefined;
		} catch {}
	}, []);
}
