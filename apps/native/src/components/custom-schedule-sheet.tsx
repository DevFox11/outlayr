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
import { useStore } from "@tanstack/react-form";
import { type Ref, useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import {
	RECURRING_TYPE,
	SELECTABLE_RECURRING_TYPES,
} from "@/domain/recurrence";
import { type TranslateFn, type TranslationKey, useTranslation } from "@/i18n";
import { useColors } from "@/theme/use-colors";
import { useAppForm } from "./form/create-app-form";
import { pressSubmit } from "./form/submit-guard";
import { Text } from "./text";

const SNAP_POINTS = ["50%"];

const UNIT_TITLE_KEY: Record<number, TranslationKey> = {
	[RECURRING_TYPE.daily]: "transaction.cadence.days",
	[RECURRING_TYPE.weekly]: "transaction.cadence.weeks",
	[RECURRING_TYPE.monthly]: "transaction.cadence.months",
	[RECURRING_TYPE.yearly]: "transaction.cadence.years",
};

const INTERVAL_KEY: Record<
	number,
	{ readonly one: TranslationKey; readonly many: TranslationKey }
> = {
	[RECURRING_TYPE.daily]: {
		one: "transaction.interval.day",
		many: "transaction.interval.days",
	},
	[RECURRING_TYPE.weekly]: {
		one: "transaction.interval.week",
		many: "transaction.interval.weeks",
	},
	[RECURRING_TYPE.monthly]: {
		one: "transaction.interval.month",
		many: "transaction.interval.months",
	},
	[RECURRING_TYPE.yearly]: {
		one: "transaction.interval.year",
		many: "transaction.interval.years",
	},
};

/**
 * The "day" / "3 months" fragment both `Every {interval}` and
 * `Repeats every {interval}` embed. Composed rather than written out per cadence
 * because English and Spanish take the same shape here, and the count is a plain
 * integer the caller already clamped — no locale number formatting is involved.
 */
export function intervalPhrase(
	t: TranslateFn,
	type: number,
	coefficient: number,
): string {
	const n = Math.max(1, Math.round(coefficient));
	const keys = INTERVAL_KEY[type] ?? INTERVAL_KEY[RECURRING_TYPE.monthly];
	return n <= 1 ? t(keys.one) : t(keys.many, { count: n });
}

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
	ref?: Ref<BottomSheetModal>;
}

export type CustomScheduleSheetRef = BottomSheetModal;

function normalizeSchedule(type: number, coefficient: number) {
	return {
		type: type === RECURRING_TYPE.none ? RECURRING_TYPE.monthly : type,
		coefficient: Math.max(1, coefficient),
	};
}

/**
 * Edits are LOCAL until Done, so Cancel leaves the form's schedule untouched.
 * Present via the forwarded ref: `ref.current?.present()`.
 */
export function CustomScheduleSheet({
	recurringType,
	recurringCoefficient,
	onDone,
	ref,
}: CustomScheduleSheetProps) {
	const colors = useColors();
	const t = useTranslation();
	const sheetRef = useRef<BottomSheetModal>(null);

	const [initialValues] = useState(() =>
		normalizeSchedule(recurringType, recurringCoefficient),
	);
	const form = useAppForm({
		defaultValues: initialValues,
		onSubmit: async ({ value }) => {
			onDone(value.type, value.coefficient);
			sheetRef.current?.dismiss();
		},
	});
	const { type: localType, coefficient: localCoefficient } = useStore(
		form.store,
		(s) => s.values,
	);

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
		form.reset(normalizeSchedule(recurringType, recurringCoefficient));
	}, [recurringType, recurringCoefficient, form.reset]);

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
					{t("transaction.schedule.customTitle")}
				</Text>
				<Pressable
					accessibilityRole="button"
					className="absolute top-0 bottom-0 left-4 justify-center active:opacity-60"
					hitSlop={8}
					onPress={() => sheetRef.current?.dismiss()}
				>
					<Text className="text-callout text-tint">{t("common.cancel")}</Text>
				</Pressable>
				<Pressable
					accessibilityRole="button"
					className="absolute top-0 right-4 bottom-0 justify-center active:opacity-60"
					hitSlop={8}
					onPress={() => pressSubmit(form)}
				>
					<Text className="font-sans-semibold text-callout text-tint">
						{t("common.done")}
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
								{t("transaction.schedule.repeats", {
									interval: intervalPhrase(t, localType, localCoefficient),
								})}
							</SwiftText>
						}
					>
						<HStack>
							<SwiftText modifiers={[BODY]}>
								{t("transaction.schedule.everyLabel")}
							</SwiftText>
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
								onValueChange={(next) =>
									form.setFieldValue("coefficient", Math.round(next))
								}
								step={1}
								value={localCoefficient}
							/>
						</HStack>
						<Picker
							label={t("transaction.schedule.unit")}
							modifiers={[pickerStyle("segmented")]}
							onSelectionChange={(next) => form.setFieldValue("type", next)}
							selection={localType}
						>
							{SELECTABLE_RECURRING_TYPES.map((type) => (
								<SwiftText key={type} modifiers={[tag(type)]}>
									{t(UNIT_TITLE_KEY[type] ?? "transaction.cadence.months")}
								</SwiftText>
							))}
						</Picker>
					</Section>
				</Form>
			</Host>
		</BottomSheetModal>
	);
}
