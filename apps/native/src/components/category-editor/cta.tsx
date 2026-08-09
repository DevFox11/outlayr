import { Button, Host, HStack, Spacer, Text as SwiftText } from "@expo/ui/swift-ui";
import { buttonStyle, controlSize, disabled, tint, type ViewModifier } from "@expo/ui/swift-ui/modifiers";
import { BODY_SEMIBOLD, CTA_HEIGHT } from "@/components/editor-style";

interface CategoryEditorCtaProps {
	canSave: boolean;
	label: string;
	onPress: () => void;
	tintColor: string;
	underPicker: ViewModifier[];
}

export function CategoryEditorCta({ label, canSave, tintColor, underPicker, onPress }: CategoryEditorCtaProps) {
	return (
		<Host style={{ height: CTA_HEIGHT }}>
			<Button
				modifiers={[
					buttonStyle("borderedProminent"),
					controlSize("large"),
					tint(tintColor),
					disabled(!canSave),
					...underPicker,
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
