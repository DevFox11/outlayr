import {
	Button,
	DatePicker,
	HStack,
	Image,
	Menu,
	Picker,
	Section,
	Spacer,
	Text as SwiftText,
	TextField,
	type useNativeState,
} from "@expo/ui/swift-ui";
import {
	accessibilityLabel,
	buttonStyle,
	contentShape,
	datePickerStyle,
	font,
	foregroundStyle,
	labelsHidden,
	listSectionMargins,
	multilineTextAlignment,
	onTapGesture,
	shapes,
	tag,
} from "@expo/ui/swift-ui/modifiers";
import type { EntryRateType } from "@outlayr/money/rates";
import { FORM_TOP_MARGIN } from "@/components/editor-style";
import { menuTint } from "@/components/native/styles";

const ROW_LABEL = foregroundStyle({ style: "secondary", type: "hierarchical" } as const);
const CHEVRON = font({ design: "rounded", textStyle: "footnote", weight: "semibold" });
const HERO = font({ design: "rounded", textStyle: "largeTitle", weight: "bold" });
const CAPTION = font({ design: "rounded", textStyle: "footnote", weight: "regular" });

interface RateOption {
	label: string;
	value: EntryRateType;
}

interface TransferEditorSlipProps {
	arrivedLabel: string | null;
	crossCurrency: boolean;
	dateLabel: string;
	fromLabel: string;
	fromName: string;
	mutedColor: string;
	noteLabel: string;
	notePlaceholder: string;
	noteState: ReturnType<typeof useNativeState<string>>;
	onArrivedPress: () => void;
	onDateChange: (date: Date) => void;
	onFromPress: () => void;
	onRatePress: () => void;
	onRateTypeChange: (type: EntryRateType) => void;
	onSentPress: () => void;
	onSwap: () => void;
	onToPress: () => void;
	rateLabel: string;
	rateOptions: RateOption[];
	rateType: EntryRateType;
	rateUnit: string;
	rateValue: string;
	selectedDate: Date;
	sentLabel: string;
	swapA11y: string;
	tintColor: string;
	toLabel: string;
	toName: string;
}

export function TransferEditorSlip({
	arrivedLabel,
	crossCurrency,
	dateLabel,
	fromLabel,
	fromName,
	mutedColor,
	noteLabel,
	notePlaceholder,
	noteState,
	onArrivedPress,
	onDateChange,
	onFromPress,
	onRatePress,
	onRateTypeChange,
	onSentPress,
	onSwap,
	onToPress,
	rateLabel,
	rateOptions,
	rateType,
	rateUnit,
	rateValue,
	selectedDate,
	sentLabel,
	swapA11y,
	tintColor,
	toLabel,
	toName,
}: TransferEditorSlipProps) {
	return (
		<>
			<Section modifiers={[listSectionMargins({ edges: "top", length: FORM_TOP_MARGIN })]}>
				<HStack modifiers={[contentShape(shapes.rectangle()), onTapGesture(onSentPress)]}>
					<Spacer />
					<SwiftText modifiers={[HERO, foregroundStyle(tintColor)]}>{sentLabel}</SwiftText>
					<Spacer />
				</HStack>
				{arrivedLabel ? (
					<HStack modifiers={[contentShape(shapes.rectangle()), onTapGesture(onArrivedPress)]}>
						<Spacer />
						<SwiftText modifiers={[CAPTION, foregroundStyle(mutedColor)]}>{arrivedLabel}</SwiftText>
						<Spacer />
					</HStack>
				) : null}
			</Section>

			<Section>
				<HStack modifiers={[contentShape(shapes.rectangle()), onTapGesture(onFromPress)]}>
					<SwiftText modifiers={[ROW_LABEL]}>{fromLabel}</SwiftText>
					<Spacer />
					<SwiftText modifiers={[foregroundStyle(tintColor)]}>{fromName}</SwiftText>
					<Image color={mutedColor} modifiers={[CHEVRON]} systemName="chevron.right" />
				</HStack>

				<HStack>
					<Button modifiers={[buttonStyle("plain"), accessibilityLabel(swapA11y)]} onPress={onSwap}>
						<Image color={tintColor} size={16} systemName="arrow.up.arrow.down" />
					</Button>
					<Spacer />
				</HStack>

				<HStack modifiers={[contentShape(shapes.rectangle()), onTapGesture(onToPress)]}>
					<SwiftText modifiers={[ROW_LABEL]}>{toLabel}</SwiftText>
					<Spacer />
					<SwiftText modifiers={[foregroundStyle(tintColor)]}>{toName}</SwiftText>
					<Image color={mutedColor} modifiers={[CHEVRON]} systemName="chevron.right" />
				</HStack>
			</Section>

			{crossCurrency ? (
				<Section footer={<SwiftText>{rateUnit}</SwiftText>}>
					<HStack>
						<SwiftText modifiers={[ROW_LABEL]}>{rateLabel}</SwiftText>
						<Spacer />
						<Menu
							label={
								<HStack spacing={4}>
									<SwiftText modifiers={[foregroundStyle(tintColor)]}>
										{rateOptions.find((option) => option.value === rateType)?.label ?? rateType}
									</SwiftText>
									<Image color={mutedColor} size={12} systemName="chevron.up.chevron.down" />
								</HStack>
							}
							modifiers={[menuTint]}
						>
							<Picker onSelectionChange={(value) => onRateTypeChange(value as EntryRateType)} selection={rateType}>
								{rateOptions.map((option) => (
									<SwiftText key={option.value} modifiers={[tag(option.value)]}>
										{option.label}
									</SwiftText>
								))}
							</Picker>
						</Menu>
					</HStack>
					<HStack modifiers={[contentShape(shapes.rectangle()), onTapGesture(onRatePress)]}>
						<Spacer />
						<SwiftText modifiers={[foregroundStyle(rateType === "custom" ? tintColor : mutedColor)]}>
							{rateValue}
						</SwiftText>
					</HStack>
				</Section>
			) : null}

			<Section>
				<HStack>
					<SwiftText modifiers={[ROW_LABEL]}>{dateLabel}</SwiftText>
					<Spacer />
					<DatePicker
						displayedComponents={["date"]}
						modifiers={[datePickerStyle("compact"), labelsHidden()]}
						onDateChange={onDateChange}
						selection={selectedDate}
					/>
				</HStack>
				<HStack>
					<SwiftText modifiers={[ROW_LABEL]}>{noteLabel}</SwiftText>
					<Spacer />
					<TextField modifiers={[multilineTextAlignment("trailing")]} placeholder={notePlaceholder} text={noteState} />
				</HStack>
			</Section>
		</>
	);
}
