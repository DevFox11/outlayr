/**
 * `work`, or `sentinel` once `ms` has passed — with the timer cleared either way.
 *
 * Racing a bare `setTimeout` leaves its handle live for the whole window after
 * the call has already won, so every lookup keeps a pending task around for as
 * long as its timeout allows. The sentinel is returned rather than thrown
 * because every caller here branches on the timeout as an outcome rather than
 * as an error.
 */
export async function withTimeout<Result, Sentinel>(
    work: Promise<Result>,
    ms: number,
    sentinel: Sentinel
): Promise<Result | Sentinel> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            work,
            new Promise<Sentinel>((resolve) => {
                timer = setTimeout(() => resolve(sentinel), ms);
            }),
        ]);
    } finally {
        clearTimeout(timer);
    }
}
