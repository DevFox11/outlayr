/**
 * Measures a perf change against main on the perf emulator. Each run restores the
 * perf-seeded snapshot, cold-starts the app on one side's Metro, and replays one
 * Argent flow under the React profiler. Runs alternate base and PR so drift on
 * the host hits both sides, and the table reports each side's median.
 *
 *   node --import tsx scripts/perf/measure.ts --flow perf-add-entry \
 *     --base 8090 --pr 8091 [--runs 3] [--device emulator-5580] [--out result.json] \
 *     [--components "Forget(RootStack),Forget(Log(./(tabs)/(transactions)/index.tsx))"]
 *
 * `--components` adds a row per component with the times it rendered in slow commits, a
 * count that whole-tree noise cannot hide. Argent keeps only commits over 16 ms and their
 * neighbours, so a component that renders only in fast commits reads 0. Names are the
 * profiler's, verbatim.
 *
 * Each port is a Metro serving that side's checkout to the perf build. Flows are
 * the Argent flows in `./flows`. Run it on a quiet host: the numbers are only
 * comparable within one invocation.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { availableParallelism, loadavg } from "node:os";
import { dirname, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs } from "node:util";

const APP = "com.tryoutlayr.app";
const SNAPSHOT = "perf-seeded";
const READY_TEXT = "Hide amounts";
const MAX_ATTEMPTS = 5;
/** Four launches of 45 s each: the three minutes a single launch used to get. */
const LAUNCHES = 4;
const LAUNCH_POLLS = 22;
/** Metro drops a dead app within about 65 s (a ping every 5 s, 60 s without a pong). */
const DRAIN_POLLS = 40;
const STARTUP_SETTLE_MS = 10_000;

const { values: args } = parseArgs({
    options: {
        base: { type: "string" },
        components: { type: "string" },
        device: { default: "emulator-5580", type: "string" },
        flow: { type: "string" },
        out: { type: "string" },
        pr: { type: "string" },
        runs: { default: "3", type: "string" },
    },
});

if (args.flow === undefined || args.base === undefined || args.pr === undefined) {
    throw new Error("Usage: measure.ts --flow <name> --base <metro port> --pr <metro port> [--runs N]");
}

const { device, flow } = args;
const runCount = Number(args.runs);
if (!Number.isInteger(runCount) || runCount < 1) {
    throw new Error(`--runs must be a positive integer, got ${args.runs}`);
}
const flowFile = resolve(import.meta.dirname, "flows", `${flow}.yaml`);
const components = args.components?.split(",").filter(Boolean) ?? [];
const sides = { base: Number(args.base), pr: Number(args.pr) } as const;
type Side = keyof typeof sides;

interface Run {
    /** argent's per-commit render causes for each `--components` entry, for the JSON only. */
    causes: Record<string, string>;
    commits: number;
    /** Times each `--components` entry rendered in the slow commits argent keeps. */
    components: Record<string, number>;
    fiberRenders: number;
    hotCommits: number;
    profiledMs: number;
    side: Side;
}

const adb = (...rest: string[]) => execFileSync("adb", ["-s", device, ...rest], { encoding: "utf-8" });

/** Runs one argent tool and returns its JSON result; argent reports tool failures as text. */
function argent(tool: string, flags: string[]): Record<string, unknown> {
    const output = execFileSync("argent", ["run", tool, ...flags], { encoding: "utf-8" }).trim();
    if (!output.startsWith("{")) {
        throw new Error(`argent ${tool}: ${output}`);
    }
    return JSON.parse(output) as Record<string, unknown>;
}

const OCCURRENCES = /\*\*Total occurrences:\*\* (\d+)/;

/** Times the component rendered in the stopped session's slow commits (0 when it never did), and why. */
function rendersOf(component: string, target: string[]): { causes: string; renders: number } {
    const output = execFileSync(
        "argent",
        [
            "run",
            "profiler-commit-query",
            ...target,
            "--mode",
            "by_component",
            "--component_name",
            component,
            "--top_n",
            "10",
        ],
        { encoding: "utf-8" }
    );
    if (output.includes("not found in this profiling session")) {
        return { causes: "", renders: 0 };
    }
    const renders = OCCURRENCES.exec(output)?.[1];
    if (renders === undefined) {
        throw new Error(`profiler-commit-query ${component}: ${output.slice(0, 300)}`);
    }
    return { causes: output, renders: Number(renders) };
}

async function debugTargetCount(port: number): Promise<number> {
    const targets = (await fetch(`http://localhost:${port}/json/list`).then((response) =>
        response.json()
    )) as unknown[];
    return targets.length;
}

async function debugTargetAttached(port: number, polls: number): Promise<boolean> {
    for (let poll = 0; poll < polls; poll += 1) {
        if ((await debugTargetCount(port)) > 0) {
            return true;
        }
        await sleep(2000);
    }
    return false;
}

/**
 * Waits for Metro to list no app, so the next entry is the launch's own. An app that died without
 * closing its socket stays listed until Metro's heartbeat gives up, about a minute, under the same
 * id a relaunch registers.
 */
async function waitForNoDebugTarget(port: number) {
    for (let poll = 0; poll < DRAIN_POLLS; poll += 1) {
        if ((await debugTargetCount(port)) === 0) {
            return;
        }
        await sleep(2000);
    }
    throw new Error(`Metro on ${port} still lists an app ${DRAIN_POLLS * 2} s after it was stopped.`);
}

/**
 * A cold start, so the app opens fresh debugger and packager sockets to the side's Metro. It
 * reaches Metro through the emulator's host address rather than `adb reverse`: the emulator's
 * adb connection can drop mid-flow, and a reverse tunnel takes the profiler's debugger with it.
 *
 * Right after a snapshot load the guest network can still time out connecting to the host, and
 * the dev client then sits on its error screen, so an app that has not attached is relaunched.
 */
async function startOn(port: number) {
    // Stopped before the load, so its socket closes now rather than at Metro's heartbeat timeout.
    adb("shell", "am", "force-stop", APP);
    const loaded = adb("emu", "avd", "snapshot", "load", SNAPSHOT);
    if (!loaded.includes("OK")) {
        throw new Error(`Snapshot ${SNAPSHOT} did not load: ${loaded}`);
    }
    adb("wait-for-device");
    const url = encodeURIComponent(`http://10.0.2.2:${port}`);
    let attached = false;
    for (let launch = 0; launch < LAUNCHES && !attached; launch += 1) {
        adb("shell", "am", "force-stop", APP);
        // oxlint-disable-next-line no-await-in-loop -- the stopped app must leave Metro's list before the next launch
        await waitForNoDebugTarget(port);
        adb(
            "shell",
            "am",
            "start",
            "-a",
            "android.intent.action.VIEW",
            "-d",
            `exp+outlayr://expo-development-client/?url=${url}`,
            APP
        );
        // oxlint-disable-next-line no-await-in-loop -- each launch waits for the previous one to attach
        attached = await debugTargetAttached(port, LAUNCH_POLLS);
    }
    if (!attached) {
        throw new Error(`No app attached to Metro on ${port} after ${LAUNCHES} launches.`);
    }
    const ready = argent("await-ui-element", [
        "--udid",
        device,
        "--condition",
        "visible",
        "--selector-json",
        JSON.stringify({ text: READY_TEXT }),
        "--timeoutMs",
        "120000",
    ]);
    if (ready.success !== true) {
        throw new Error(`The Log never showed on ${port}: ${JSON.stringify(ready)}`);
    }
}

/** Waits up to five minutes for the host's one-minute load to drop below 1.5x its core count. */
async function waitForQuietHost() {
    for (let check = 0; check < 30 && (loadavg()[0] ?? 0) > availableParallelism() * 1.5; check += 1) {
        // oxlint-disable-next-line no-await-in-loop -- polling
        await sleep(10_000);
    }
    if ((loadavg()[0] ?? 0) > availableParallelism() * 1.5) {
        process.stderr.write(`Host load still ${loadavg()[0]?.toFixed(1)} after five minutes; measuring anyway.\n`);
    }
}

async function measure(side: Side): Promise<Run> {
    const port = sides[side];
    await waitForQuietHost();
    await startOn(port);
    const target = ["--device_id", device, "--port", String(port)];
    argent("debugger-connect", target);
    // Startup work (session, entitlement, adoption) still lands a context commit or two after the
    // Log shows; profiled, it reads as a render the flow never caused.
    await sleep(STARTUP_SETTLE_MS);
    argent("react-profiler-start", target);
    // The debugger can drop a couple of seconds after the start; fail before the flow rather than after it.
    await sleep(3000);
    const status = argent("react-profiler-status", target);
    if (status.session_status !== "active") {
        throw new Error(`The profiler session dropped right after it started: ${JSON.stringify(status)}`);
    }
    execFileSync("argent", ["flow", "run", flowFile, "--device", device], { stdio: "inherit" });
    const stopped = argent("react-profiler-stop", target);
    const commits = Number(stopped.total_react_commits);
    if (!Number.isFinite(commits) || commits < 1) {
        throw new Error(`The profiler captured no commits on ${side}: ${JSON.stringify(stopped)}`);
    }
    const hotCommits = Array.isArray(stopped.hot_commit_indices) ? stopped.hot_commit_indices.length : 0;
    const queried = new Map(
        components.map((component) => [
            component,
            hotCommits === 0 ? { causes: "", renders: 0 } : rendersOf(component, target),
        ])
    );
    return {
        causes: Object.fromEntries([...queried].map(([component, { causes }]) => [component, causes])),
        commits,
        components: Object.fromEntries([...queried].map(([component, { renders }]) => [component, renders])),
        fiberRenders: Number(stopped.fiber_renders_captured),
        hotCommits,
        profiledMs: Math.round(Number(stopped.duration_ms)),
        side,
    };
}

/**
 * Gives a failed run up to four more tries: host load can leave the UI tree unreadable, and the
 * debugger can fail to connect or drop the profile after the app cold-starts.
 */
async function measureWithRetries(side: Side): Promise<Run> {
    for (let attempt = 1; ; attempt += 1) {
        try {
            // oxlint-disable-next-line no-await-in-loop -- attempts share one emulator
            return await measure(side);
        } catch (error) {
            if (attempt === MAX_ATTEMPTS) {
                throw error;
            }
            let screen = resolve(args.out === undefined ? "." : dirname(args.out), `failed-${side}-${Date.now()}.png`);
            try {
                writeFileSync(screen, execFileSync("adb", ["-s", device, "exec-out", "screencap", "-p"]));
            } catch {
                screen = "not captured";
            }
            process.stderr.write(
                `Retrying ${side} (screen: ${screen}): ${error instanceof Error ? error.message : String(error)}\n`
            );
        }
    }
}

const median = (values: number[]) => {
    const sorted = values.toSorted((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2 : (sorted[middle] ?? 0);
};

async function main() {
    const runs: Run[] = [];
    for (let round = 0; round < runCount; round += 1) {
        // Alternate which side goes first, so a slow host phase does not always land on one side.
        const order: Side[] = round % 2 === 0 ? ["base", "pr"] : ["pr", "base"];
        for (const side of order) {
            // oxlint-disable-next-line no-await-in-loop -- runs share one emulator, so they must not overlap
            const run = await measureWithRetries(side);
            runs.push(run);
            const { causes: _causes, ...summary } = run;
            process.stdout.write(`${JSON.stringify(summary)}\n`);
        }
    }

    const metrics = ["commits", "fiberRenders", "hotCommits", "profiledMs"] as const;
    const labels: Record<(typeof metrics)[number], string> = {
        commits: "React commits",
        fiberRenders: "Component renders",
        hotCommits: "Commits over 16 ms",
        profiledMs: "Flow time (ms)",
    };
    const row = (label: string, value: (run: Run) => number) => {
        const base = median(runs.filter((run) => run.side === "base").map(value));
        const pr = median(runs.filter((run) => run.side === "pr").map(value));
        const change = base === 0 ? "n/a" : `${(((pr - base) / base) * 100).toFixed(1)}%`;
        return `| ${label} | ${base} | ${pr} | ${change} |`;
    };
    const rows = [
        ...metrics.map((metric) => row(labels[metric], (run) => run[metric])),
        ...components.map((component) =>
            row(`\`${component}\` renders in slow commits`, (run) => run.components[component] ?? 0)
        ),
    ];
    const neverRendered = components.filter((component) => runs.every((run) => run.components[component] === 0));
    if (neverRendered.length > 0) {
        process.stderr.write(
            `Never rendered in a slow commit on either side; check the names, or they only render in fast commits: ${neverRendered.join(", ")}\n`
        );
    }
    const table = [
        `Flow \`${flow}\`, median of ${runCount} runs per side, alternated, on ${device}.`,
        "",
        "| Metric | main | PR | Change |",
        "|---|---|---|---|",
        ...rows,
    ].join("\n");
    process.stdout.write(`\n${table}\n`);
    if (args.out !== undefined) {
        writeFileSync(args.out, JSON.stringify({ flow, runs, table }, null, 2));
    }
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
