import { FreezeOnBlur } from "@/components/freeze-on-blur";
import { Budgets } from "@/screens/budgets";

export default function BudgetsScreen() {
    return (
        <FreezeOnBlur tab="budgets">
            <Budgets />
        </FreezeOnBlur>
    );
}
