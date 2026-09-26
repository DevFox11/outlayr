import { useEffect, useState } from "react";

export const LONG_WAIT_MS = 2000;

export function useLongWait(waiting: boolean): boolean {
    const [long, setLong] = useState(false);

    useEffect(() => {
        if (!waiting) {
            return;
        }
        const timer = setTimeout(() => setLong(true), LONG_WAIT_MS);
        return () => {
            clearTimeout(timer);
            setLong(false);
        };
    }, [waiting]);

    return waiting && long;
}
