import { FreezeOnBlur } from "@/components/freeze-on-blur";
import BudgetsScreen from "@/screens/budgets";

export default function Budgets() {
	return (
		<FreezeOnBlur>
			<BudgetsScreen />
		</FreezeOnBlur>
	);
}
