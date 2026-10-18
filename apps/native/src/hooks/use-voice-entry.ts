import { useUIMessages } from "@convex-dev/agent/react";
import {
    AudioQuality,
    getRecordingPermissionsAsync,
    IOSOutputFormat,
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
    useAudioRecorder,
} from "expo-audio";
import type { RecordingOptions } from "expo-audio";
import { File } from "expo-file-system";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSharedValue } from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";

import {
    judgeSilence,
    localIsoDate,
    meterToLevel,
    proposedDraftOf,
    startSilenceWatch,
    voiceTurnsOf,
} from "@/domain/voice-entry";
import type { VoiceTurn } from "@/domain/voice-entry";
import { duringHandoff } from "@/lib/app-handoff";
import { VOICE_TURNS_QUERY, voiceThreadTransport } from "@/lib/convex";
import type { SpeakRequest, StartThreadResult, VoiceDraft, VoiceQuote, VoiceThreadTransport } from "@/lib/convex";
import { withTimeout } from "@/lib/with-timeout";

/**
 * One sentence of speech, mono, at the lowest AAC rate that still transcribes
 * cleanly: ~6KB/s against the server's 900KB cap and the 45s recording cap.
 * `isMeteringEnabled` is what makes `getStatus().metering` exist at all.
 */
const RECORDING_OPTIONS: RecordingOptions = {
    android: { audioEncoder: "aac", extension: ".m4a", outputFormat: "mpeg4" },
    bitRate: 48_000,
    extension: ".m4a",
    ios: {
        audioQuality: AudioQuality.MEDIUM,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
        outputFormat: IOSOutputFormat.MPEG4AAC,
    },
    isMeteringEnabled: true,
    numberOfChannels: 1,
    sampleRate: 44_100,
    web: { bitsPerSecond: 48_000, mimeType: "audio/webm" },
};

/** The meter is read this often; the orb smooths it, so faster buys nothing. */
const METER_INTERVAL_MS = 50;
/** Transcription plus the agent's turn behind one request; past this the network, not the model, is the problem. */
const REQUEST_TIMEOUT_MS = 25_000;
/** A screen holds a handful of turns; corrections only ever look at the last few. */
const TURNS_PAGE = 40;

export type VoiceFailure =
    | "denied"
    | "silent"
    | "unclear"
    | "offline"
    | "timeout"
    | "notConfigured"
    | "unauthenticated"
    | "rateLimited"
    | "notEntitled"
    | "quotaExceeded"
    | "provider";

/**
 * `Context` is whatever the caller needs to read the draft back in the
 * ledger's terms — the candidates it offered the model, the currency it sent.
 * It rides from the send to the review, because the ledger can change
 * underneath a request in flight.
 */
export type VoicePhase<Context = unknown> =
    | { kind: "starting" }
    | { kind: "listening" }
    | { after: number; clip: ArrayBuffer; kind: "sending" }
    /** The words landed at `order`; the agent's answer at the same order is the draft. */
    | { context: Context; kind: "thinking"; order: number }
    | { context: Context; draft: VoiceDraft; kind: "review"; order: number; quotes: readonly VoiceQuote[] }
    | { kind: "failed"; reason: VoiceFailure; transcript: string | null };

interface UseVoiceEntryArgs<Context> {
    /** Snapshotted with the request; the review phase hands it back. */
    context: Context;
    /**
     * Everything but the clip, the thread and the date, built fresh by the
     * caller each render. `today` is read when the clip is sent, so a screen
     * that sat across midnight still says which day "today" is.
     */
    request: Omit<SpeakRequest, "audio" | "threadId" | "today">;
    /** Defaults to the real transport; a fake is for tests. */
    transport?: VoiceThreadTransport;
}

export interface UseVoiceEntryResult<Context> {
    /** Stops listening and discards the clip. Safe in any phase. */
    cancel: () => void;
    /** Ends the clip now and sends it, instead of waiting for the trailing silence. */
    finish: () => void;
    heard: string | null;
    /** Input level 0–1, written on the meter interval and read by the orb on the UI thread. */
    level: SharedValue<number>;
    /**
     * Listens for another sentence on the same thread: a correction after a
     * draft, or a second try after a failure. The thread keeps every turn.
     */
    listenAgain: () => void;
    phase: VoicePhase<Context>;
    spoke: boolean;
    /** The thread so far: every sentence and every draft it produced. */
    turns: VoiceTurn[];
}

function failureFor(status: string): VoiceFailure {
    switch (status) {
        case "unclear": {
            return "silent";
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

async function readAndDiscard(uri: string): Promise<ArrayBuffer> {
    const file = new File(uri);
    const bytes = await file.arrayBuffer();
    // A clip is spent the moment it is read; leaving it would collect one
    // recording per entry in the cache directory.
    try {
        file.delete();
    } catch {
        // The cache is the OS's to sweep; a leftover clip costs nothing but bytes.
    }
    return bytes;
}

/**
 * The listen → send → review loop behind the voice screen, on one agent thread.
 *
 * Listening starts on mount: the screen exists to hear one sentence, so the
 * first thing it does is ask. The thread opens in parallel and the first clip
 * waits for it. Every clip after that is another turn on the same thread, so
 * "no, that was yesterday" reaches the model with the draft it corrects.
 *
 * The meter runs on a timer rather than through `useAudioRecorderState`,
 * which would re-render the screen twenty times a second for a number that
 * only moves the orb; the level goes into a shared value instead.
 *
 * The draft is never returned by the send: it arrives through the turns
 * query, as the `proposeDraft` output on the assistant message at the order
 * the send reported. One path for the first draft and every correction.
 *
 * Must render inside the Convex provider, which the root layout mounts only
 * for a signed-in session; the screen gates on that before rendering this.
 */
export function useVoiceEntry<Context>({
    context,
    request,
    transport,
}: UseVoiceEntryArgs<Context>): UseVoiceEntryResult<Context> {
    const recorder = useAudioRecorder(RECORDING_OPTIONS);
    const level = useSharedValue(0);
    const [phase, setPhase] = useState<VoicePhase<Context>>({ kind: "starting" });
    const [threadId, setThreadId] = useState<string | null>(null);
    const [spoke, setSpoke] = useState(false);
    /** Bumped by every cancel/listenAgain so a stop racing a start cannot land on the wrong take. */
    const takeRef = useRef(0);
    const meterRef = useRef<ReturnType<typeof setInterval> | null>(null);
    /** The take whose stop is already under way, so nothing ends it twice. */
    const endingRef = useRef<number | null>(null);
    const sentRef = useRef<ArrayBuffer | null>(null);
    const threadRef = useRef<string | null>(null);
    /** The clip already resent once on a fresh thread; a second `invalid` is a real failure. */
    const resentRef = useRef<ArrayBuffer | null>(null);
    const disposedRef = useRef(false);
    const lastOrderRef = useRef(-1);
    const [api] = useState(() => transport ?? voiceThreadTransport());

    const { results: messages } = useUIMessages(VOICE_TURNS_QUERY, threadId === null ? "skip" : { threadId }, {
        initialNumItems: TURNS_PAGE,
        stream: true,
    });

    useEffect(() => {
        lastOrderRef.current = messages.reduce((last, message) => Math.max(last, message.order), -1);
    }, [messages]);

    const stopMeter = useCallback(() => {
        if (meterRef.current !== null) {
            clearInterval(meterRef.current);
            meterRef.current = null;
        }
        level.set(0);
    }, [level]);

    const endTake = useCallback(
        async (take: number, outcome: "send" | "silent" | "discard") => {
            // Claimed before the first await: a second tap on the orb, or the
            // silence timer firing under one, would otherwise race this call
            // for one recorder and one file and could turn a good clip into a
            // silent failure.
            if (endingRef.current === take) {
                return;
            }
            endingRef.current = take;
            stopMeter();
            let uri: string | null = null;
            try {
                await recorder.stop();
                ({ uri } = recorder);
            } catch {
                // A recorder that never started, or one the screen's unmount
                // already released, throws here; there is no clip either way.
            }
            // A discard, or a take retired while the recorder was stopping (the
            // screen closed under it): the clip is spent either way.
            if (outcome === "discard" || take !== takeRef.current) {
                if (uri) {
                    await readAndDiscard(uri).catch(() => null);
                }
                return;
            }
            if (outcome === "silent" || !uri) {
                if (uri) {
                    await readAndDiscard(uri).catch(() => null);
                }
                setPhase({ kind: "failed", reason: "silent", transcript: null });
                return;
            }
            try {
                const clip = await readAndDiscard(uri);
                if (take === takeRef.current) {
                    setPhase({ after: lastOrderRef.current, clip, kind: "sending" });
                }
            } catch {
                if (take === takeRef.current) {
                    setPhase({ kind: "failed", reason: "provider", transcript: null });
                }
            }
        },
        [recorder, stopMeter]
    );

    /**
     * The microphone was already open when the thread failed to: stop it and
     * retire the take, so the silence timer cannot report on a clip that has
     * nowhere to go and a retry starts from a released recorder.
     */
    const abandonTake = useCallback(() => {
        const take = takeRef.current;
        takeRef.current += 1;
        void endTake(take, "discard");
    }, [endTake]);

    /**
     * Opens the thread the clips will land on. Called on mount, and again by
     * `listenAgain` when the first attempt failed, so a retry after an outage
     * is a retry and not a clip with nowhere to go. `disposedRef` is the
     * unmount, which turns a late-arriving thread into an immediate `end`.
     */
    const openThread = useCallback(async () => {
        let opened: StartThreadResult;
        try {
            opened = await api.start();
        } catch {
            if (!disposedRef.current) {
                abandonTake();
                setPhase({ kind: "failed", reason: "offline", transcript: null });
            }
            return;
        }
        if (disposedRef.current) {
            // The screen closed before the thread opened; nothing was said on it.
            if (opened.threadId !== null) {
                await api.end(opened.threadId).catch(() => null);
            }
            return;
        }
        threadRef.current = opened.threadId;
        setThreadId(opened.threadId);
        if (opened.threadId === null) {
            abandonTake();
            setPhase({
                kind: "failed",
                reason: opened.status === "rateLimited" ? "rateLimited" : "unauthenticated",
                transcript: null,
            });
        }
    }, [abandonTake, api]);

    /** Forgets the current thread so the next clip waits for a fresh one. */
    const dropThread = useCallback(() => {
        const id = threadRef.current;
        threadRef.current = null;
        setThreadId(null);
        if (id !== null) {
            api.end(id).catch(() => null);
        }
    }, [api]);

    useEffect(() => {
        disposedRef.current = false;
        // Deferred a tick, as the microphone start is: the effect body sets no
        // state itself, and the thread's outcome arrives from the network.
        void Promise.resolve().then(() => (disposedRef.current ? undefined : openThread()));
        return () => {
            disposedRef.current = true;
            const id = threadRef.current;
            if (id !== null) {
                api.end(id).catch(() => null);
            }
        };
    }, [api, openThread]);

    const startTake = useCallback(async () => {
        takeRef.current += 1;
        const take = takeRef.current;
        // The phase moves only after the first await, so a mount effect calling
        // this sets no state synchronously; "starting" is the initial phase.
        // Only an undecided permission shows a prompt, and only that trip out is
        // announced to the app lock.
        const current = await getRecordingPermissionsAsync();
        const permission = current.granted ? current : await duringHandoff(requestRecordingPermissionsAsync);
        if (take !== takeRef.current) {
            return;
        }
        setPhase({ kind: "starting" });
        if (!permission.granted) {
            setPhase({ kind: "failed", reason: "denied", transcript: null });
            return;
        }
        try {
            await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
            await recorder.prepareToRecordAsync();
            if (take !== takeRef.current) {
                return;
            }
            recorder.record();
        } catch {
            if (take === takeRef.current) {
                setPhase({ kind: "failed", reason: "provider", transcript: null });
            }
            return;
        }
        setPhase({ kind: "listening" });
        setSpoke(false);

        let watch = startSilenceWatch(Date.now());
        meterRef.current = setInterval(() => {
            const status = recorder.getStatus();
            const sample = meterToLevel(status.metering);
            level.set(sample);
            const judged = judgeSilence(watch, sample, Date.now());
            if (watch.lastSpeechAt === null && judged.watch.lastSpeechAt !== null) {
                setSpoke(true);
            }
            ({ watch } = judged);
            if (judged.verdict === "keep") {
                return;
            }
            void endTake(take, judged.verdict === "nothingSaid" ? "silent" : "send");
        }, METER_INTERVAL_MS);
    }, [endTake, level, recorder]);

    useEffect(() => {
        // Deferred a tick so the effect body itself sets no state: the microphone
        // is the external system here, and the phase changes arrive from it.
        let disposed = false;
        void Promise.resolve().then(() => (disposed ? undefined : startTake()));
        return () => {
            disposed = true;
            takeRef.current += 1;
            stopMeter();
            // Nothing is asked of the recorder here: `useAudioRecorder`'s own
            // cleanup has already released the native object by the time this
            // runs, and even reading `isRecording` on a released shared object
            // throws. Releasing it is what stops the recording.
        };
        // Runs once in practice: the recorder is one shared object for the
        // screen's life and both callbacks close over stable values only.
    }, [startTake, stopMeter]);

    useEffect(() => {
        if (phase.kind !== "sending" || threadId === null || sentRef.current === phase.clip) {
            return;
        }
        sentRef.current = phase.clip;
        const take = takeRef.current;
        const { clip } = phase;
        void (async () => {
            try {
                const settled = await withTimeout(
                    api.speak({ ...request, audio: clip, threadId, today: localIsoDate(new Date()) }),
                    REQUEST_TIMEOUT_MS,
                    "timeout" as const
                );
                if (take !== takeRef.current) {
                    return;
                }
                if (settled === "timeout") {
                    // The request may still land a draft on this thread after
                    // the screen gave up on it; a retry must not speak into a
                    // thread with an answer nobody saw. Start the next one clean.
                    dropThread();
                    setPhase({ kind: "failed", reason: "timeout", transcript: null });
                    return;
                }
                if (settled.status === "ok" && settled.order !== null) {
                    setPhase({ context, kind: "thinking", order: settled.order });
                    return;
                }
                if (settled.status === "invalid" && resentRef.current !== clip) {
                    // The thread expired under the screen (the server sweeps one
                    // idle for an hour). Open another and let this effect send the
                    // same clip again when its id lands; a correction on it will
                    // read as a new sentence, which is the honest outcome.
                    resentRef.current = clip;
                    sentRef.current = null;
                    setPhase({ after: -1, clip, kind: "sending" });
                    dropThread();
                    void openThread();
                    return;
                }
                setPhase({ kind: "failed", reason: failureFor(settled.status), transcript: settled.transcript });
            } catch {
                if (take === takeRef.current) {
                    setPhase({ kind: "failed", reason: "offline", transcript: null });
                }
            }
        })();
    }, [api, context, dropThread, openThread, phase, request, threadId]);

    // The answer to a sent turn is read off the thread, not set by an effect:
    // the phase says which order it is waiting on, and the messages say
    // whether that order has been answered yet.
    const settledPhase = useMemo<VoicePhase<Context>>(() => {
        if (phase.kind !== "thinking") {
            return phase;
        }
        const answer = messages.find((message) => message.role === "assistant" && message.order === phase.order);
        if (answer === undefined) {
            return phase;
        }
        const proposed = proposedDraftOf(answer);
        if (proposed !== null) {
            if (proposed.draft === null) {
                const said = messages.find((message) => message.role === "user" && message.order === phase.order);
                return { kind: "failed", reason: "unclear", transcript: said?.text ?? null };
            }
            return {
                context: phase.context,
                draft: proposed.draft,
                kind: "review",
                order: phase.order,
                quotes: proposed.quotes ?? [],
            };
        }
        return answer.status === "failed" ? { kind: "failed", reason: "provider", transcript: null } : phase;
    }, [messages, phase]);

    const turns = useMemo(() => voiceTurnsOf(messages), [messages]);

    const heard = useMemo(() => {
        const said = (matches: (order: number) => boolean) =>
            messages.find((message) => message.role === "user" && matches(message.order))?.text ?? null;
        switch (settledPhase.kind) {
            case "sending": {
                return said((order) => order > settledPhase.after);
            }
            case "thinking":
            case "review": {
                return said((order) => order === settledPhase.order);
            }
            case "failed": {
                return settledPhase.transcript;
            }
            default: {
                return null;
            }
        }
    }, [messages, settledPhase]);

    const finish = useCallback(() => {
        if (phase.kind === "listening") {
            void endTake(takeRef.current, "send");
        }
    }, [endTake, phase.kind]);

    const cancel = useCallback(() => {
        const take = takeRef.current;
        takeRef.current += 1;
        if (phase.kind === "listening" || phase.kind === "starting") {
            void endTake(take, "discard");
        }
    }, [endTake, phase.kind]);

    const listenAgain = useCallback(() => {
        if (threadRef.current === null) {
            void openThread();
        }
        void startTake();
    }, [openThread, startTake]);

    return { cancel, finish, heard, level, listenAgain, phase: settledPhase, spoke, turns };
}
