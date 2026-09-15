import { CloseToolbar } from "@/components/close-toolbar";
import { Paywall } from "@/screens/paywall";

export default function PaywallScreen() {
    return (
        <>
            <CloseToolbar placement="right" />
            <Paywall />
        </>
    );
}
