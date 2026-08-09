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
	VStack,
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
import type { FeeSide } from "@/domain/transfer-reconcile";

const ROW_LABEL = foregroundStyle({ style: "secondary", type: "hierarchical" } as const);
const CHEVRON = font({ design: "rounded", textStyle: "footnote", weight: "semibold" });
const HERO = font({ design: "rounded", textStyle: "largeTitle", weight: "bold" });
const CAPTION = font({ design: "rounded", textStyle: "footnote", weight: "regular" });

interface RateOption {
	label: string;
	value: EntryRateType;
}

/**
 * Present only when `sent x rate` and `arrived` disagree, which can happen only
 * after the user deliberately typed an arrival. The two readings are
 * numerically identical, so the app cannot pick — but it can show what each one
 * would mean and take one tap.
 */
export interface TransferGapPrompt {
	feeLabel: string;
	message: string;
	onFee: () => void;
	onRate: () => void;
	rateLabel: string;
}

interface FeeSideOption {
	label: string;
	value: FeeSide;
}

interface TransferEditorSlipProps {
	addFeeLabel: string;
	arrivedLabel: string | null;
	crossCurrency: boolean;
	dateLabel: string;
	feeLabel: string;
	feeSide: FeeSide;
	feeSideOptions: FeeSideOption[];
	feeValue: string | null;
	fromLabel: string;
	fromName: string;
	gap: TransferGapPrompt | null;
	mutedColor: string;
	noteLabel: string;
	notePlaceholder: string;
	noteState: ReturnType<typeof useNativeState<string>>;
	onArrivedPress: () => void;
	onDateChange: (date: Date) => void;
	onFeePress: () => void;
	onFeeSideChange: (side: FeeSide) => void;
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
	warnColor: string;
}

export function TransferEditorSlip({
	addFeeLabel,
	arrivedLabel,
	crossCurrency,
	dateLabel,
	feeLabel,
	feeSide,
	feeSideOptions,
	feeValue,
	fromLabel,
	fromName,
	gap,
	mutedColor,
	noteLabel,
	notePlaceholder,
	noteState,
	onArrivedPress,
	onDateChange,
	onFeePress,
	onFeeSideChange,
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
	warnColor,
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

				{gap ? (
					<VStack alignment="leading" spacing={8}>
						<SwiftText modifiers={[CAPTION, foregroundStyle(warnColor)]}>{gap.message}</SwiftText>
						<HStack spacing={8}>
							<Button modifiers={[buttonStyle("bordered")]} onPress={gap.onFee}>
								<SwiftText modifiers={[CAPTION]}>{gap.feeLabel}</SwiftText>
							</Button>
							<Button modifiers={[buttonStyle("bordered")]} onPress={gap.onRate}>
								<SwiftText modifiers={[CAPTION]}>{gap.rateLabel}</SwiftText>
							</Button>
							<Spacer />
						</HStack>
					</VStack>
				) : null}

				<HStack>
					<SwiftText modifiers={[contentShape(shapes.rectangle()), onTapGesture(onFeePress), ROW_LABEL]}>
						{feeLabel}
					</SwiftText>
					<Spacer />
					{feeValue ? (
						<Menu
							label={
								<HStack spacing={4}>
									<SwiftText modifiers={[CAPTION, foregroundStyle(mutedColor)]}>
										{feeSideOptions.find((option) => option.value === feeSide)?.label ?? feeSide}
									</SwiftText>
									<Image color={mutedColor} size={10} systemName="chevron.up.chevron.down" />
								</HStack>
							}
							modifiers={[menuTint]}
						>
							<Picker onSelectionChange={(value) => onFeeSideChange(value as FeeSide)} selection={feeSide}>
								{feeSideOptions.map((option) => (
									<SwiftText key={option.value} modifiers={[tag(option.value)]}>
										{option.label}
									</SwiftText>
								))}
							</Picker>
						</Menu>
					) : null}
					<SwiftText
						modifiers={[
							contentShape(shapes.rectangle()),
							onTapGesture(onFeePress),
							foregroundStyle(feeValue ? tintColor : mutedColor),
						]}
					>
						{feeValue ?? addFeeLabel}
					</SwiftText>
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
