import { Button, Host, HStack, Spacer, Text as SwiftText } from "@expo/ui/swift-ui";
import { buttonStyle, controlSize, disabled, tint } from "@expo/ui/swift-ui/modifiers";
import { BODY_SEMIBOLD, CTA_HEIGHT } from "@/components/editor-style";

interface TransferEditorCtaProps {
	canSave: boolean;
	label: string;
	onPress: () => void;
	tintColor: string;
}

export function TransferEditorCta({ label, canSave, tintColor, onPress }: TransferEditorCtaProps) {
	return (
		<Host style={{ height: CTA_HEIGHT }}>
			<Button
				modifiers={[buttonStyle("borderedProminent"), controlSize("large"), tint(tintColor), disabled(!canSave)]}
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
