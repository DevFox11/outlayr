import { SymbolView } from "expo-symbols";
import { BottomSheet } from "panelui-native";
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

	return (
		<BottomSheet onOpenChange={onOpenChange} open={open}>
			{/* Its own close is `bg-muted`, which is a TEXT colour in this theme and
			    renders as a grey slab — so the glass button below stands in for it. */}
			<BottomSheet.Content showClose={false} size="auto">
				<View className="gap-6 px-5 pb-safe-offset-3">
					<View className="flex-row justify-end">
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
			</BottomSheet.Content>
		</BottomSheet>
	);
}
