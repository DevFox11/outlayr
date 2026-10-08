import {
    addNotificationResponseReceivedListener,
    clearLastNotificationResponse,
    getLastNotificationResponse,
} from "expo-notifications";
import type { NotificationResponse } from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { z } from "zod";

import { backfillRecurring } from "@/data/recurrence-backfill";
import { getTransactionById } from "@/data/transactions-core";
import type { Database } from "@/db/client";
import { RECURRING_TYPE } from "@/domain/recurrence";

const reminderTapSchema = z.object({ charge: z.string(), subscription: z.string() });

function announcedRowId(db: Database, { charge, subscription }: z.infer<typeof reminderTapSchema>): string | null {
    const landed = getTransactionById(db, charge);
    if (landed !== null && landed.deletedAt === null) {
        return charge;
    }
    const carrier = getTransactionById(db, subscription);
    const pending = carrier !== null && carrier.deletedAt === null && carrier.recurringType > RECURRING_TYPE.none;
    return pending ? subscription : null;
}

let handled: string | null = null;

export function useSubscriptionReminderTaps(db: Database, ready: boolean): void {
    const router = useRouter();

    useEffect(() => {
        if (!ready) {
            return;
        }
        let disposed = false;
        const open = async (response: NotificationResponse | null) => {
            const parsed = reminderTapSchema.safeParse(response?.notification.request.content.data);
            if (!parsed.success || response === null) {
                return;
            }
            const tap = `${response.notification.request.identifier}@${response.notification.date}`;
            await backfillRecurring(db, parsed.data.subscription);
            const id = announcedRowId(db, parsed.data);
            if (disposed || tap === handled || id === null) {
                return;
            }
            router.navigate(`/transactions/${id}`);
            handled = tap;
            clearLastNotificationResponse();
        };
        const handle = (response: NotificationResponse | null) => {
            open(response).catch((error) => {
                console.warn("[outlayr] subscription reminder tap failed", error);
            });
        };

        handle(getLastNotificationResponse());
        const subscription = addNotificationResponseReceivedListener(handle);
        return () => {
            disposed = true;
            subscription.remove();
        };
    }, [db, ready, router]);
}
