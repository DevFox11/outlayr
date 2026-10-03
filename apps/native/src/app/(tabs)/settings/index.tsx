import { FreezeOnBlur } from "@/components/freeze-on-blur";
import { Settings } from "@/screens/settings";

export default function SettingsScreen() {
    return (
        <FreezeOnBlur tab="settings">
            <Settings />
        </FreezeOnBlur>
    );
}
