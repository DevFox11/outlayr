import {
	HStack,
	Spacer,
	Text as SwiftText,
	TextField,
	type useNativeState,
	VStack,
} from "@expo/ui/swift-ui";
import type { ViewModifier } from "@expo/ui/swift-ui/modifiers";
import {
	foregroundStyle,
	lineLimit,
	padding,
} from "@expo/ui/swift-ui/modifiers";
import { Note01Icon } from "@hugeicons-pro/core-stroke-rounded";
import { TransactionFormRowIcon } from "./row-icon";
import { BODY, rowLabel } from "./style";

interface TransactionFormDetailsSectionProps {
	notesLabel: string;
	notesPlaceholder: string;
	notes: ReturnType<typeof useNativeState<string>>;
	foregroundColor: string;
	mutedColor: string;
	card: ViewModifier[];
}

export function TransactionFormDetailsSection({
	notesLabel,
	notesPlaceholder,
	notes,
	mutedColor,
	foregroundColor,
	card,
}: TransactionFormDetailsSectionProps) {
	return (
		<VStack
			alignment="leading"
			modifiers={[padding({ vertical: 14 }), ...card]}
			spacing={8}
		>
			<HStack spacing={12}>
				<TransactionFormRowIcon color={mutedColor} icon={Note01Icon} />
				<SwiftText modifiers={[BODY, rowLabel]}>{notesLabel}</SwiftText>
				<Spacer />
			</HStack>
			<TextField
				axis="vertical"
				modifiers={[
					BODY,
					foregroundStyle(foregroundColor),
					lineLimit({ min: 3, max: 6 }),
				]}
				placeholder={notesPlaceholder}
				text={notes}
			/>
		</VStack>
	);
}
