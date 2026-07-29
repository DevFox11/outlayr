import { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import {
	Form,
	Host,
	HStack,
	Picker,
	Section,
	Spacer,
	Stepper,
	Text as SwiftText,
} from "@expo/ui/swift-ui";
import {
	font,
	foregroundStyle,
	labelsHidden,
	pickerStyle,
	scrollDisabled,
	tag,
} from "@expo/ui/swift-ui/modifiers";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import {
	cadenceUnitTitle,
	customSchedulePreview,
	RECURRING_TYPE,
	SELECTABLE_RECURRING_TYPES,
} from "@/domain/recurrence";
import { useColors } from "@/theme/use-colors";
import { Text } from "./text";

const SNAP_POINTS = ["50%"];

const BODY = font({ textStyle: "body", design: "rounded" });
const BODY_SEMIBOLD = font({
	textStyle: "body",
	design: "rounded",
	weight: "semibold",
});
const FOOTNOTE = font({ textStyle: "footnote", design: "rounded" });

interface CustomScheduleSheetProps {
	recurringType: number;
	recurringCoefficient: number;
	onDone: (recurringType: number, recurringCoefficient: number) => void;
}

export type CustomScheduleSheetRef = BottomSheetModal;

/**
 * Edits are LOCAL until Done, so Cancel leaves the form's schedule untouched.
 * Present via the forwarded ref: `ref.current?.present()`.
 */
export const CustomScheduleSheet = forwardRef<
	BottomSheetModal,
	CustomScheduleSheetProps
>(function CustomScheduleSheet(
	{ recurringType, recurringCoefficient, onDone },
	ref,
) {
	const colors = useColors();
	const sheetRef = useRef<BottomSheetModal>(null);
	const [localType, setLocalType] = useState(RECURRING_TYPE.monthly as number);
	const [localCoefficient, setLocalCoefficient] = useState(2);

	const setRefs = useCallback(
		(node: BottomSheetModal | null) => {
			sheetRef.current = node;
			if (typeof ref === "function") {
				ref(node);
			} else if (ref) {
				ref.current = node;
			}
		},
		[ref],
	);

	useEffect(() => {
		setLocalType(
			recurringType === RECURRING_TYPE.none
				? RECURRING_TYPE.monthly
				: recurringType,
		);
		setLocalCoefficient(Math.max(1, recurringCoefficient));
	}, [recurringType, recurringCoefficient]);

	const confirm = () => {
		onDone(localType, localCoefficient);
		sheetRef.current?.dismiss();
	};

	return (
		<BottomSheetModal
			backgroundStyle={{ backgroundColor: colors.groupedBackground }}
			enableDynamicSizing={false}
			enablePanDownToClose
			ref={setRefs}
			snapPoints={SNAP_POINTS}
		>
			<View className="h-11 justify-center px-4">
				<Text
					accessibilityRole="header"
					className="text-center font-sans-semibold text-callout text-foreground"
				>
					Custom Schedule
				</Text>
				<Pressable
					accessibilityRole="button"
					className="absolute top-0 bottom-0 left-4 justify-center active:opacity-60"
					hitSlop={8}
					onPress={() => sheetRef.current?.dismiss()}
				>
					<Text className="text-callout text-tint">Cancel</Text>
				</Pressable>
				<Pressable
					accessibilityRole="button"
					className="absolute top-0 right-4 bottom-0 justify-center active:opacity-60"
					hitSlop={8}
					onPress={confirm}
				>
					<Text className="font-sans-semibold text-callout text-tint">
						Done
					</Text>
				</Pressable>
			</View>

			{/* NOT `matchContents`: a Form fills its container rather than reporting
			    an intrinsic height, so sizing the Host to its content collapses it to
			    zero and the sheet renders empty below the header. */}
			<Host style={{ flex: 1 }}>
				{/* The sheet already scrolls, so the Form must not add a second axis. */}
				<Form modifiers={[scrollDisabled(true)]}>
					<Section
						footer={
							<SwiftText modifiers={[FOOTNOTE]}>
								{customSchedulePreview(localType, localCoefficient)}
							</SwiftText>
						}
					>
						<HStack>
							<SwiftText modifiers={[BODY]}>Every</SwiftText>
							<Spacer />
							<SwiftText
								modifiers={[BODY_SEMIBOLD, foregroundStyle(colors.muted)]}
							>
								{String(localCoefficient)}
							</SwiftText>
							<Stepper
								label=""
								max={30}
								min={1}
								modifiers={[labelsHidden()]}
								onValueChange={(next) => setLocalCoefficient(Math.round(next))}
								step={1}
								value={localCoefficient}
							/>
						</HStack>
						<Picker
							label="Unit"
							modifiers={[pickerStyle("segmented")]}
							onSelectionChange={setLocalType}
							selection={localType}
						>
							{SELECTABLE_RECURRING_TYPES.map((type) => (
								<SwiftText key={type} modifiers={[tag(type)]}>
									{cadenceUnitTitle(type)}
								</SwiftText>
							))}
						</Picker>
					</Section>
				</Form>
			</Host>
		</BottomSheetModal>
	);
});
