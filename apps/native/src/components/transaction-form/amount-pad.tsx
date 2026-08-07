import { BottomSheet } from "panelui-native";

import { AmountNumpad } from "../amount-numpad";

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
	return (
		<BottomSheet onOpenChange={onOpenChange} open={open} native>
			<BottomSheet.Content size="auto">
				<AmountNumpad
					code={code}
					minorUnits={minorUnits}
					onChange={onChange}
					showDisplay={false}
					toneClass={income ? "text-income" : "text-foreground"}
					value={value}
				/>
			</BottomSheet.Content>
		</BottomSheet>
	);
}
