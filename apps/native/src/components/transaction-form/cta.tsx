import {
	Button,
	Host,
	HStack,
	Spacer,
	Text as SwiftText,
} from "@expo/ui/swift-ui";
import {
	buttonStyle,
	controlSize,
	disabled,
	foregroundStyle,
	tint,
} from "@expo/ui/swift-ui/modifiers";
import { BODY_SEMIBOLD } from "./style";

interface TransactionFormCtaProps {
	label: string;
	canSave: boolean;
	tintColor: string;
	labelColor: string;
	onPress: () => void;
}

export function TransactionFormCta({
	label,
	canSave,
	tintColor,
	labelColor,
	onPress,
}: TransactionFormCtaProps) {
	return (
		// No `matchContents` — the Host must take the full available width so the
		// button's Spacer-flanked label can stretch across it, standing in for
		// Swift's `.frame(maxWidth: .infinity)`.
		<Host style={{ height: 50 }}>
			<Button
				modifiers={[
					buttonStyle("borderedProminent"),
					controlSize("large"),
					tint(tintColor),
					foregroundStyle(labelColor),
					disabled(!canSave),
				]}
				onPress={onPress}
			>
				<HStack>
					<Spacer />
					<SwiftText modifiers={[BODY_SEMIBOLD]}>{label}</SwiftText>
					<Spacer />
				</HStack>
			</Button>
		</Host>
	);
}
