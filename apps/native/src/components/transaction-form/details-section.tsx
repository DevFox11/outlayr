import {
	Button,
	Divider,
	HStack,
	Image,
	Spacer,
	Text as SwiftText,
	TextField,
	type useNativeState,
	VStack,
} from "@expo/ui/swift-ui";
import type { ViewModifier } from "@expo/ui/swift-ui/modifiers";
import {
	buttonStyle,
	foregroundStyle,
	lineLimit,
	padding,
} from "@expo/ui/swift-ui/modifiers";
import type { ReactNode } from "react";
import { BODY, rowLabel, TAP_ROW } from "./style";

interface TransactionFormDetailsSectionProps {
	accountLabel: string;
	accountName: string | null;
	accountNoneLabel: string;
	accountTile?: ReactNode;
	onAccountPress: () => void;
	notesLabel: string;
	notesPlaceholder: string;
	notes: ReturnType<typeof useNativeState<string>>;
	foregroundColor: string;
	mutedColor: string;
	hairline: ViewModifier[];
	card: ViewModifier[];
}

export function TransactionFormDetailsSection({
	accountLabel,
	accountName,
	accountNoneLabel,
	accountTile,
	onAccountPress,
	notesLabel,
	notesPlaceholder,
	notes,
	foregroundColor,
	mutedColor,
	hairline,
	card,
}: TransactionFormDetailsSectionProps) {
	return (
		<VStack modifiers={card} spacing={0}>
			<Button modifiers={[buttonStyle("plain")]} onPress={onAccountPress}>
				<HStack modifiers={TAP_ROW} spacing={12}>
					<SwiftText modifiers={[BODY, rowLabel]}>{accountLabel}</SwiftText>
					<Spacer />
					<HStack spacing={5}>
						{accountName ? accountTile : null}
						<SwiftText
							modifiers={[
								BODY,
								foregroundStyle(accountName ? foregroundColor : mutedColor),
							]}
						>
							{accountName ?? accountNoneLabel}
						</SwiftText>
						<Image
							color={mutedColor}
							size={12}
							systemName="chevron.up.chevron.down"
						/>
					</HStack>
				</HStack>
			</Button>
			<Divider modifiers={hairline} />
			<VStack
				alignment="leading"
				modifiers={[padding({ all: 16 })]}
				spacing={8}
			>
				<HStack>
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
		</VStack>
	);
}
