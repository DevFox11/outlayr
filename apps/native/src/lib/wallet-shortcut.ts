import { Linking } from "react-native";

/**
 * The iCloud link to the shared "Outlayr Wallet" shortcut: the Log a Wallet
 * Transaction action with Amount, Merchant and Card already bound to the Wallet
 * transaction, so installing it is one tap. Null until it has been shared from
 * a phone running this build, in which case the screen falls back to walking
 * the user through building it.
 *
 * Re-share and update this whenever `LogWalletTransactionIntent`'s parameters
 * change: a shortcut is a snapshot of the action, not a reference to it.
 */
export const WALLET_SHORTCUT_URL: string | null = null;

/**
 * Undocumented but stable since iOS 17: lands on the Automations tab, which is
 * where the Wallet trigger is created. The bare scheme is the documented
 * fallback and opens Shortcuts wherever it was left.
 */
const AUTOMATIONS_URL = "shortcuts://automations";
const SHORTCUTS_URL = "shortcuts://";

export async function openWalletShortcut(): Promise<void> {
    await Linking.openURL(WALLET_SHORTCUT_URL ?? SHORTCUTS_URL);
}

export async function openShortcutsAutomations(): Promise<void> {
    try {
        await Linking.openURL(AUTOMATIONS_URL);
    } catch {
        await Linking.openURL(SHORTCUTS_URL);
    }
}
