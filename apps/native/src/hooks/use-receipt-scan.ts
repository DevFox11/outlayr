import {
    CameraType,
    launchCameraAsync,
    launchImageLibraryAsync,
    requestCameraPermissionsAsync,
} from "expo-image-picker";
import type { ImagePickerResult } from "expo-image-picker";
import { useCallback, useEffect, useRef, useState } from "react";

import { localIsoDate } from "@/domain/voice-entry";
import { receiptScanTransport } from "@/lib/convex";
import type { ReceiptDraft, ReceiptScanFn, ScanRequest } from "@/lib/convex";
import { prepareReceiptImage } from "@/lib/receipt-image";
import { withTimeout } from "@/lib/with-timeout";

/** The re-encode plus one vision call; past this the network, not the model, is the problem. */
const REQUEST_TIMEOUT_MS = 30_000;

export type ScanFailure =
    | "denied"
    | "noCamera"
    | "unreadable"
    | "unclear"
    | "offline"
    | "timeout"
    | "notConfigured"
    | "unauthenticated"
    | "rateLimited"
    | "notEntitled"
    | "quotaExceeded"
    | "provider";

type ScanSource = "camera" | "library";

/** The photo on screen: the picker's own file, at the size it reported. */
export interface ScanPhoto {
    height: number;
    uri: string;
    width: number;
}

/**
 * `Context` is whatever the caller needs to read the draft back in the
 * ledger's terms — the candidates it offered the model, the currency it sent.
 * The review carries the snapshot from when the photo left, because the
 * ledger can change underneath a request in flight.
 */
type ScanPhase<Context = unknown> =
    /** Nothing picked yet; the screen offers the camera and the library. */
    | { kind: "idle" }
    /** The system camera or library is up; the screen waits behind it. */
    | { kind: "picking"; source: ScanSource }
    /** The photo is chosen and being re-encoded, then read. */
    | { kind: "scanning"; photo: ScanPhoto }
    | { context: Context; draft: ReceiptDraft; kind: "review"; photo: ScanPhoto }
    | { kind: "failed"; photo: ScanPhoto | null; reason: ScanFailure };

interface UseReceiptScanArgs<Context> {
    /** Snapshotted with the request; the review phase hands it back. */
    context: Context;
    /**
     * Everything but the photo and the date, built fresh by the caller each
     * render. `today` is read when the photo is sent.
     */
    request: Omit<ScanRequest, "image" | "today">;
    /** Defaults to the real transport; a fake is for tests. */
    transport?: ReceiptScanFn;
}

export interface UseReceiptScanResult<Context> {
    /** Opens the system library. */
    chooseFromLibrary: () => void;
    phase: ScanPhase<Context>;
    /** Back to the start: no photo, no draft. */
    reset: () => void;
    /** Reads the last photo again, after a failure that was not the photo's fault. */
    retry: () => void;
    /** Opens the system camera; on a device without one, fails as `noCamera`. */
    takePhoto: () => void;
}

function failureFor(status: string): ScanFailure {
    switch (status) {
        case "unclear": {
            return "unclear";
        }
        case "notConfigured": {
            return "notConfigured";
        }
        case "unauthenticated": {
            return "unauthenticated";
        }
        case "rateLimited": {
            return "rateLimited";
        }
        case "notEntitled": {
            return "notEntitled";
        }
        case "quotaExceeded": {
            return "quotaExceeded";
        }
        default: {
            return "provider";
        }
    }
}

/**
 * The pick → read → review loop behind the scan screen.
 *
 * The camera is the system's: `launchCameraAsync` presents the platform
 * capture UI, which already knows about flash, focus and the simulator's lack
 * of a lens. The photo is then re-encoded to the server's size and sent as
 * bytes with the ledger's names; the draft comes straight back.
 *
 * `takeRef` retires a read the screen has moved past — a reset or another
 * pick while a request is in flight — so a late answer cannot land on a
 * photo that is no longer on screen.
 */
export function useReceiptScan<Context>({
    context,
    request,
    transport,
}: UseReceiptScanArgs<Context>): UseReceiptScanResult<Context> {
    const [phase, setPhase] = useState<ScanPhase<Context>>({ kind: "idle" });
    const takeRef = useRef(0);
    const [api] = useState(() => transport ?? receiptScanTransport());
    const sentRef = useRef({ context, request });
    useEffect(() => {
        sentRef.current = { context, request };
    });

    const read = useCallback(
        async (photo: ScanPhoto, take: number) => {
            setPhase({ kind: "scanning", photo });
            let prepared: Awaited<ReturnType<typeof prepareReceiptImage>>;
            try {
                prepared = await prepareReceiptImage(photo.uri);
            } catch {
                prepared = null;
            }
            if (take !== takeRef.current) {
                return;
            }
            if (prepared === null) {
                setPhase({ kind: "failed", photo, reason: "unreadable" });
                return;
            }
            const { context: sentContext, request: sent } = sentRef.current;
            try {
                const settled = await withTimeout(
                    api({ ...sent, image: prepared.bytes, today: localIsoDate(new Date()) }),
                    REQUEST_TIMEOUT_MS,
                    "timeout" as const
                );
                if (take !== takeRef.current) {
                    return;
                }
                if (settled === "timeout") {
                    setPhase({ kind: "failed", photo, reason: "timeout" });
                    return;
                }
                if (settled.status === "ok" && settled.receipt !== null) {
                    setPhase({ context: sentContext, draft: settled.receipt, kind: "review", photo });
                    return;
                }
                setPhase({ kind: "failed", photo, reason: failureFor(settled.status) });
            } catch {
                if (take === takeRef.current) {
                    setPhase({ kind: "failed", photo, reason: "offline" });
                }
            }
        },
        [api]
    );

    const adopt = useCallback(
        (result: ImagePickerResult, take: number) => {
            if (take !== takeRef.current) {
                return;
            }
            const asset = result.canceled ? undefined : result.assets[0];
            if (asset === undefined) {
                setPhase({ kind: "idle" });
                return;
            }
            void read({ height: asset.height, uri: asset.uri, width: asset.width }, take);
        },
        [read]
    );

    const takePhoto = useCallback(() => {
        takeRef.current += 1;
        const take = takeRef.current;
        setPhase({ kind: "picking", source: "camera" });
        void (async () => {
            let permission: Awaited<ReturnType<typeof requestCameraPermissionsAsync>>;
            try {
                permission = await requestCameraPermissionsAsync();
            } catch {
                if (take === takeRef.current) {
                    setPhase({ kind: "failed", photo: null, reason: "noCamera" });
                }
                return;
            }
            if (take !== takeRef.current) {
                return;
            }
            if (!permission.granted) {
                setPhase({ kind: "failed", photo: null, reason: "denied" });
                return;
            }
            try {
                const result = await launchCameraAsync({
                    cameraType: CameraType.back,
                    mediaTypes: ["images"],
                    quality: 0.9,
                });
                adopt(result, take);
            } catch {
                // The one way the launch itself rejects on iOS is a device with no
                // camera to present — the simulator, or a broken lens.
                if (take === takeRef.current) {
                    setPhase({ kind: "failed", photo: null, reason: "noCamera" });
                }
            }
        })();
    }, [adopt]);

    const chooseFromLibrary = useCallback(() => {
        takeRef.current += 1;
        const take = takeRef.current;
        setPhase({ kind: "picking", source: "library" });
        void (async () => {
            try {
                const result = await launchImageLibraryAsync({
                    allowsEditing: false,
                    mediaTypes: ["images"],
                    quality: 1,
                });
                adopt(result, take);
            } catch {
                if (take === takeRef.current) {
                    setPhase({ kind: "failed", photo: null, reason: "unreadable" });
                }
            }
        })();
    }, [adopt]);

    const retry = useCallback(() => {
        if (phase.kind !== "failed" || phase.photo === null) {
            return;
        }
        takeRef.current += 1;
        void read(phase.photo, takeRef.current);
    }, [phase, read]);

    const reset = useCallback(() => {
        takeRef.current += 1;
        setPhase({ kind: "idle" });
    }, []);

    useEffect(
        () => () => {
            // The screen is gone; whatever answers now has nowhere to land.
            takeRef.current += 1;
        },
        []
    );

    return { chooseFromLibrary, phase, reset, retry, takePhoto };
}
