import { useCallback } from "react";
import { Alert } from "react-native";
import { formatDayHeader } from "@/domain/dates";
import {
	type CardableSection,
	type DayCardOptions,
	dayCardContent,
	dayCardFileName,
} from "@/domain/day-card-content";
import { shareDayCard } from "./day-card-image";

/**
 * Swift offered this from a long press on the day group
 * (`Features/Transactions/Views/ListView.swift:52-63`) and wrote straight to the
 * photo album. The share sheet is used instead — see `shareDayCard` — so the
 * feature needs no photo-library permission.
 */
export function useDayCardShare(
	options: DayCardOptions,
): (section: CardableSection) => void {
	return useCallback(
		(section: CardableSection) => {
			Alert.alert(formatDayHeader(section.day), undefined, [
				{
					text: "Share as Image",
					onPress: () => {
						shareDayCard(
							dayCardContent(section, options),
							dayCardFileName(section.day),
						).catch((error: unknown) => {
							Alert.alert(
								"Couldn't share the day",
								error instanceof Error
									? error.message
									: "The image couldn't be drawn.",
							);
						});
					},
				},
				{ text: "Cancel", style: "cancel" },
			]);
		},
		[options],
	);
}
