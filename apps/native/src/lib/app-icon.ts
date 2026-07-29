import {
	getAppIconName,
	setAlternateAppIcon,
	supportsAlternateIcons,
} from "expo-alternate-app-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

export const alternateIconsSupported: boolean = supportsAlternateIcons;

/**
 * iOS is the only record of which icon is on — nothing is persisted app-side,
 * so a setting can never disagree with the home screen.
 */
function readAppIconName(): string | null {
	try {
		return getAppIconName();
	} catch {
		return null;
	}
}

export function useAppIcon(): {
	active: string | null;
	choose: (name: string | null) => void;
} {
	const [active, setActive] = useState(readAppIconName);

	useFocusEffect(
		useCallback(() => {
			setActive(readAppIconName());
		}, []),
	);

	const choose = useCallback((name: string | null) => {
		setAlternateAppIcon(name)
			.then(setActive)
			.catch((error: unknown) => {
				console.error("App icon change failed", error);
				setActive(readAppIconName());
			});
	}, []);

	return { active, choose };
}
