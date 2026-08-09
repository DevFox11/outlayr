import {
	authenticateAsync,
	getEnrolledLevelAsync,
	type LocalAuthenticationResult,
	SecurityLevel,
} from "expo-local-authentication";

/**
 * Whether the device holds anything the prompt could check. Nothing enrolled
 * means no credential can ever open the gate, and holding the ledger shut on
 * that device would strand its owner outside their own local data.
 */
export async function lockIsEnforceable(): Promise<boolean> {
	try {
		return (await getEnrolledLevelAsync()) !== SecurityLevel.NONE;
	} catch {
		return false;
	}
}

export async function requestUnlock(promptMessage: string): Promise<LocalAuthenticationResult> {
	try {
		return await authenticateAsync({
			// Left on so a failed or locked-out sensor still falls through to the
			// device passcode. Turning it off is how a lock becomes unopenable.
			disableDeviceFallback: false,
			promptMessage,
		});
	} catch {
		return { error: "unknown", success: false };
	}
}
