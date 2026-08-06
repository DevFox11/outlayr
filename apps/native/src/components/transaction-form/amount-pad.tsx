import {
	BottomSheetModal,
	BottomSheetView,
} from "@expo/ui/community/bottom-sheet";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef } from "react";
import { View } from "react-native";
import { useTranslation } from "@/i18n";
import { useColors } from "@/theme/use-colors";
import { AmountNumpad } from "../amount-numpad";
import { GlassButton } from "../glass-button";

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
	const ref = useRef<BottomSheetModal>(null);

	useEffect(() => {
		if (open) {
			ref.current?.present();
		} else {
			ref.current?.dismiss();
		}
	}, [open]);

	return (
		<BottomSheetModal
			enableDynamicSizing
			enablePanDownToClose
			onDismiss={() => onOpenChange(false)}
			ref={ref}
		>
			<BottomSheetView>
				<View className="px-4 pt-2 pb-safe-offset-3">
					<View className="flex-row justify-end pb-2">
						<GlassButton
							accessibilityLabel={t("common.done")}
							className="size-11 rounded-[22px]"
							onPress={() => onOpenChange(false)}
						>
							<SymbolView
								name="chevron.down"
								size={16}
								tintColor={colors.muted}
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
			</BottomSheetView>
		</BottomSheetModal>
	);
}
