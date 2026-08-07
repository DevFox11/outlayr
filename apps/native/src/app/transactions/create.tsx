import { useLocalSearchParams } from "expo-router";
import { NewTransaction } from "@/screens/transaction/new";

export default function NewTransactionScreen() {
	// `income`/`amount`/`note` are set only by the surfaces that open this screen
	// from outside the bundle — the "Log Income" quick action, or a Siri intent
	// handing off a draft. `from` is the opposite direction: a row already on the
	// ledger asking to be logged again, which is why it may fill in the fields a
	// suggestion from outside may not.
	const { income, amount, note, from } = useLocalSearchParams<{
		income?: string;
		amount?: string;
		note?: string;
		from?: string;
	}>();

	return (
		<NewTransaction amount={amount} from={from} income={income} note={note} />
	);
}
