import {
	Button,
	Divider,
	HStack,
	Spacer,
	Text as SwiftText,
} from "@expo/ui/swift-ui";
import type { ViewModifier } from "@expo/ui/swift-ui/modifiers";
import { buttonStyle, foregroundStyle } from "@expo/ui/swift-ui/modifiers";
import {
	BODY,
	BODY_MEDIUM,
	CAPTION,
	rowLabel,
	TAP_ROW,
	tertiary,
} from "./style";

interface TransactionFormAmountSectionProps {
	hairline: ViewModifier[];
	label: string;
	value: string;
	valueColor: string;
	currency: string;
	onPress: () => void;
}

export function TransactionFormAmountSection({
	hairline,
	label,
	value,
	valueColor,
	currency,
	onPress,
}: TransactionFormAmountSectionProps) {
	return (
		<>
			<Divider modifiers={hairline} />
			<Button modifiers={[buttonStyle("plain")]} onPress={onPress}>
				<HStack modifiers={TAP_ROW}>
					<SwiftText modifiers={[BODY, rowLabel]}>{label}</SwiftText>
					<Spacer />
					<SwiftText modifiers={[BODY_MEDIUM, foregroundStyle(valueColor)]}>
						{value}
					</SwiftText>
					<SwiftText modifiers={[CAPTION, tertiary]}>{currency}</SwiftText>
				</HStack>
			</Button>
		</>
	);
}
