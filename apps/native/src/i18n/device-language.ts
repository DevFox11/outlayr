import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { deviceLanguageTag } from "./language-storage";

function readTag(): string | null {
	try {
		return deviceLanguageTag();
	} catch {
		return null;
	}
}

/**
 * The device language, re-read whenever the app returns to the foreground.
 * Changing the language in iOS Settings restarts nothing — it backgrounds us
 * and hands the process back with a new locale, so a tag captured once at mount
 * stays stale until the next cold start.
 */
export function useDeviceLanguageTag(): string | null {
	const [tag, setTag] = useState(readTag);

	useEffect(() => {
		const subscription = AppState.addEventListener("change", (status) => {
			if (status !== "active") {
				return;
			}
			// Same string bails out of the re-render inside React.
			setTag(readTag());
		});
		return () => subscription.remove();
	}, []);

	return tag;
}
