import { Linking } from "react-native";

/**
 * The iCloud link to the shared "Outlayr - Apple Pay" shortcut: the Wallet
 * trigger, Signal a Wallet Run, and Log a Wallet Transaction with Amount,
 * Merchant, Card and Currency Code bound to the trigger. The trigger inside it
 * is an iOS 27 feature, so the screen only offers the link there.
 *
 * Re-share and update this whenever `LogWalletTransactionIntent`'s parameters
 * change: a shortcut is a snapshot of the action, not a reference to it.
 */
export const WALLET_SHORTCUT_URL: string | null = "https://www.icloud.com/shortcuts/5bbc7b635f5e4eec95884da850f4d226";

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
