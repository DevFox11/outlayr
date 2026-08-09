import { BottomSheet } from "panelui-native";

import { AmountNumpad } from "../amount-numpad";

interface TransactionFormAmountPadProps {
	code: string;
	income: boolean;
	minorUnits: number;
	onChange: (next: string) => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	value: string;
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
		<BottomSheet native onOpenChange={onOpenChange} open={open}>
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
