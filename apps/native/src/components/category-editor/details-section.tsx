import {
	HStack,
	Picker,
	Section,
	Spacer,
	Text as SwiftText,
	TextField,
	type TextFieldRef,
	type useNativeState,
} from "@expo/ui/swift-ui";
import {
	foregroundStyle,
	listSectionMargins,
	multilineTextAlignment,
	onSubmit,
	pickerStyle,
	submitLabel,
	tag,
	textInputAutocapitalization,
	tint as tintModifier,
} from "@expo/ui/swift-ui/modifiers";
import type { RefObject } from "react";
import { FORM_TOP_MARGIN } from "./style";

interface CategoryEditorDetailsSectionProps {
	caption: string | null;
	expenseLabel: string;
	income: boolean;
	incomeLabel: string;
	nameFieldRef: RefObject<TextFieldRef | null>;
	nameLabel: string;
	namePlaceholder: string;
	nameState: ReturnType<typeof useNativeState<string>>;
	onIncomeChange: (income: boolean) => void;
	onNameChange: (name: string) => void;
	onSubmitName: () => void;
	tintColor: string;
	typeLabel: string;
	typePickerVisible: boolean;
}

export function CategoryEditorDetailsSection({
	caption,
	expenseLabel,
	income,
	incomeLabel,
	nameFieldRef,
	nameLabel,
	namePlaceholder,
	nameState,
	onIncomeChange,
	onNameChange,
	onSubmitName,
	tintColor,
	typeLabel,
	typePickerVisible,
}: CategoryEditorDetailsSectionProps) {
	return (
		<Section
			footer={caption ? <SwiftText>{caption}</SwiftText> : undefined}
			modifiers={[listSectionMargins({ edges: "top", length: FORM_TOP_MARGIN })]}
		>
			<HStack>
				<SwiftText modifiers={[foregroundStyle({ style: "secondary", type: "hierarchical" })]}>{nameLabel}</SwiftText>
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

			{typePickerVisible ? (
				<HStack>
					<SwiftText modifiers={[foregroundStyle({ style: "secondary", type: "hierarchical" })]}>{typeLabel}</SwiftText>
					<Spacer />
					<Picker
						label=""
						modifiers={[pickerStyle("menu"), tintModifier(tintColor)]}
						onSelectionChange={(value) => onIncomeChange(value === "income")}
						selection={income ? "income" : "expense"}
					>
						<SwiftText modifiers={[tag("expense")]}>{expenseLabel}</SwiftText>
						<SwiftText modifiers={[tag("income")]}>{incomeLabel}</SwiftText>
					</Picker>
				</HStack>
			) : null}
		</Section>
	);
}
