import { BottomSheet, Group, Host, RNHostView } from "@expo/ui/swift-ui";
import {
	presentationBackgroundInteraction,
	presentationDragIndicator,
} from "@expo/ui/swift-ui/modifiers";
import { SymbolView } from "expo-symbols";
import { useWindowDimensions, View } from "react-native";
import { useTranslation } from "@/i18n";
import { useColors } from "@/theme/use-colors";
import { AmountNumpad } from "../amount-numpad";
import { GlassButton } from "../glass-button";

/**
 * `presentationBackgroundInteraction` is UIKit's `largestUndimmedDetentIdentifier`
 * two layers up: it drops the system backdrop and leaves the form behind live, so
 * tapping another row closes the keypad instead of being eaten by a scrim. The
 * community `BottomSheetModal` composes this same SwiftUI sheet but applies every
 * presentation modifier except this one, which is why the sheet is hand-rolled here.
 */
const SHEET = [
	presentationDragIndicator("visible"),
	presentationBackgroundInteraction("enabled"),
];

interface TransactionFormAmountPadProps {
	open: boolean;
	value: string;
	minorUnits: number;
	code: string;
	income: boolean;
	onChange: (next: string) => void;
	onOpenChange: (open: boolean) => void;
}

export function TransactionFormAmountPad({
	open,
	value,
	minorUnits,
	code,
	income,
	onChange,
	onOpenChange,
}: TransactionFormAmountPadProps) {
	const colors = useColors();
	const t = useTranslation();
	const { width } = useWindowDimensions();

	return (
		<Host pointerEvents="none" style={{ position: "absolute", width }}>
			<BottomSheet
				fitToContents
				isPresented={open}
				onIsPresentedChange={onOpenChange}
			>
				<Group modifiers={SHEET}>
					<RNHostView matchContents>
						<View className="px-4 pt-4 pb-safe-offset-3" style={{ width }}>
							<View className="flex-row justify-end pb-6">
								<GlassButton
									accessibilityLabel={t("common.close")}
									className="size-11 rounded-[22px]"
									onPress={() => onOpenChange(false)}
								>
									<SymbolView
										name="xmark"
										size={17}
										tintColor={colors.foreground}
										type="monochrome"
										weight="semibold"
									/>
								</GlassButton>
							</View>
							<AmountNumpad
								code={code}
								minorUnits={minorUnits}
								onChange={onChange}
								showDisplay={false}
								toneClass={income ? "text-income" : "text-foreground"}
								value={value}
							/>
						</View>
					</RNHostView>
				</Group>
			</BottomSheet>
		</Host>
	);
}
