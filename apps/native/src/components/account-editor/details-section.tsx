import {
	Button,
	HStack,
	Image,
	Section,
	Spacer,
	Text as SwiftText,
	TextField,
	type TextFieldRef,
	type useNativeState,
} from "@expo/ui/swift-ui";
import {
	accessibilityLabel,
	buttonStyle,
	contentShape,
	font,
	foregroundStyle,
	listSectionMargins,
	multilineTextAlignment,
	onSubmit,
	onTapGesture,
	shapes,
	submitLabel,
	textInputAutocapitalization,
} from "@expo/ui/swift-ui/modifiers";
import type { RefObject } from "react";
import { FORM_TOP_MARGIN } from "./style";

const ROW_LABEL = foregroundStyle({
	style: "secondary",
	type: "hierarchical",
} as const);
const SIGN_FONT = font({
	design: "rounded",
	textStyle: "body",
	weight: "medium",
});

interface AccountEditorDetailsSectionProps {
	balanceEditA11y: string;
	balanceLabel: string;
	balanceSignA11y: string;
	/** Already formatted for the active language and currency. */
	balanceValue: string;
	caption: string | null;
	currencyCode: string;
	currencyLabel: string;
	mutedColor: string;
	nameFieldRef: RefObject<TextFieldRef | null>;
	nameLabel: string;
	namePlaceholder: string;
	nameState: ReturnType<typeof useNativeState<string>>;
	negative: boolean;
	onBalancePress: () => void;
	onCurrencyPress: () => void;
	onNameChange: (name: string) => void;
	onSubmitName: () => void;
	onToggleSign: () => void;
	tintColor: string;
}

export function AccountEditorDetailsSection({
	caption,
	currencyCode,
	currencyLabel,
	balanceLabel,
	balanceSignA11y,
	balanceEditA11y,
	balanceValue,
	mutedColor,
	nameFieldRef,
	nameLabel,
	namePlaceholder,
	nameState,
	negative,
	onBalancePress,
	onCurrencyPress,
	onNameChange,
	onSubmitName,
	onToggleSign,
	tintColor,
}: AccountEditorDetailsSectionProps) {
	return (
		<Section
			footer={caption ? <SwiftText>{caption}</SwiftText> : undefined}
			modifiers={[listSectionMargins({ edges: "top", length: FORM_TOP_MARGIN })]}
		>
			<HStack>
				<SwiftText modifiers={[ROW_LABEL]}>{nameLabel}</SwiftText>
				<Spacer />
				<TextField
					modifiers={[
						multilineTextAlignment("trailing"),
						textInputAutocapitalization("words"),
						submitLabel("done"),
						onSubmit(onSubmitName),
					]}
					onTextChange={onNameChange}
					placeholder={namePlaceholder}
					ref={nameFieldRef}
					text={nameState}
				/>
			</HStack>

			<HStack modifiers={[contentShape(shapes.rectangle()), onTapGesture(onCurrencyPress)]}>
				<SwiftText modifiers={[ROW_LABEL]}>{currencyLabel}</SwiftText>
				<Spacer />
				<SwiftText modifiers={[foregroundStyle(tintColor)]}>{currencyCode}</SwiftText>
				<Image
					color={mutedColor}
					modifiers={[
						font({
							design: "rounded",
							textStyle: "footnote",
							weight: "semibold",
						}),
					]}
					systemName="chevron.up.chevron.down"
				/>
			</HStack>

			<HStack>
				<SwiftText modifiers={[ROW_LABEL]}>{balanceLabel}</SwiftText>
				<Spacer />
				<Button modifiers={[buttonStyle("plain"), accessibilityLabel(balanceSignA11y)]} onPress={onToggleSign}>
					<SwiftText modifiers={[SIGN_FONT, foregroundStyle(negative ? tintColor : mutedColor)]}>
						{negative ? "−" : "+"}
					</SwiftText>
				</Button>
				<Button modifiers={[buttonStyle("plain"), accessibilityLabel(balanceEditA11y)]} onPress={onBalancePress}>
					<SwiftText modifiers={[foregroundStyle(tintColor)]}>{balanceValue}</SwiftText>
				</Button>
			</HStack>
		</Section>
	);
}
