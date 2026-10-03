import { FreezeOnBlur } from "@/components/freeze-on-blur";
import { Insights } from "@/screens/insights";

export default function InsightsScreen() {
    return (
        <FreezeOnBlur tab="insights">
            <Insights />
        </FreezeOnBlur>
    );
}
