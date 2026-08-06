/**
 * Test double for `react-native-worklets`, substituted via `moduleNameMapper`
 * in `jest.config.js` so nothing from the real package is ever resolved.
 *
 * Under jest-expo, React Native's Jest resolver prefers `*.native.ts` over the
 * platform-agnostic `*.ts`, and `WorkletsModule/NativeWorklets.native.ts` in
 * `react-native-worklets@0.10.1` constructs the real Turbo Module at import time
 * with no IS_JEST guard — throwing `Cannot read properties of undefined (reading
 * 'loadUnpackers')` before `react-native-reanimated` can route around it via its
 * own `SHOULD_BE_USE_WEB` flag. `moduleNameMapper` intercepts the import, so the
 * broken file is never reached.
 *
 * The platform-agnostic pieces are copied verbatim from the package's own
 * non-native source, not reimplemented: `createSerializable` and `makeShareable`
 * are identity functions there too, not a simplification made here.
 *
 * The native-only API (`createShareable`, `createSynchronizable`,
 * `createWorkletRuntime`, `runOnRuntime*`, `runOnUISync`, `executeOnUIRuntimeSync`)
 * throws rather than no-ops, so a component that starts relying on a real
 * multi-runtime split fails loudly instead of passing on fake data.
 */

const IS_JEST = !!process.env.JEST_WORKER_ID;

const RuntimeKind = {
	ReactNative: 1,
	UI: 2,
	Worker: 3,
};

if (globalThis.__RUNTIME_KIND === undefined) {
	globalThis.__RUNTIME_KIND = RuntimeKind.ReactNative;
}
globalThis._WORKLET = false;
globalThis._log = globalThis._log ?? console.log;
globalThis._getAnimationTimestamp =
	globalThis._getAnimationTimestamp ?? (() => performance.now());

function mockedRequestAnimationFrame(callback) {
	return setTimeout(() => callback(performance.now()), 0);
}

if (IS_JEST) {
	// Same override react-native-worklets' own (unreachable, `.native.ts`
	// shadowed) safe initializer applies: RN's jest rAF polyfill calls back via
	// `setTimeout` without a timestamp argument, which reanimated's animation
	// driver needs.
	globalThis.requestAnimationFrame = mockedRequestAnimationFrame;
}

function isWorkletFunction(value) {
	return typeof value === "function" && !!value.__workletHash;
}

function createSerializable(value) {
	return value;
}
const makeShareable = createSerializable;
function isSerializableRef() {
	return true;
}
function makeShareableCloneOnUIRecursive(value) {
	return value;
}
function registerCustomSerializable() {}

const serializableMappingCache = {
	set() {},
	get() {
		return null;
	},
};

function isShareable(value) {
	return typeof value === "object" && value !== null && !!value.__shareableRef;
}
function isSynchronizable(value) {
	return (
		typeof value === "object" && value !== null && !!value.__synchronizableRef
	);
}

function getStaticFeatureFlag() {
	return false;
}
function setDynamicFeatureFlag() {}
function getDynamicFeatureFlag() {
	return false;
}

function getRuntimeKind() {
	return globalThis.__RUNTIME_KIND;
}
function isRNRuntime() {
	return globalThis.__RUNTIME_KIND === RuntimeKind.ReactNative;
}
function isUIRuntime() {
	return globalThis.__RUNTIME_KIND === RuntimeKind.UI;
}
function isWorkletRuntime() {
	return globalThis.__RUNTIME_KIND !== RuntimeKind.ReactNative;
}
function isWorkerRuntime() {
	return globalThis.__RUNTIME_KIND === RuntimeKind.Worker;
}

let runOnUIQueue = [];
function flushUIQueue() {
	queueMicrotask(() => {
		const queue = runOnUIQueue;
		runOnUIQueue = [];
		mockedRequestAnimationFrame(() => {
			for (const [worklet, args, resolve] of queue) {
				const result = worklet(...args);
				resolve?.(result);
			}
		});
	});
}
function enqueueUI(worklet, args, resolve) {
	if (IS_JEST) {
		mockedRequestAnimationFrame(() => {
			const result = worklet(...args);
			resolve?.(result);
		});
		return;
	}
	runOnUIQueue.push([worklet, args, resolve]);
	if (runOnUIQueue.length === 1) {
		flushUIQueue();
	}
}

function scheduleOnUI(worklet, ...args) {
	enqueueUI(worklet, args);
}
function runOnUI(worklet) {
	return (...args) => scheduleOnUI(worklet, ...args);
}
function runOnUISync() {
	throw new Error(
		"[worklets-stub] `runOnUISync` is not supported under jest, matching react-native-worklets' own web build. reanimated only calls it behind a `!SHOULD_BE_USE_WEB` guard.",
	);
}
function executeOnUIRuntimeSync() {
	throw new Error(
		"[worklets-stub] `executeOnUIRuntimeSync` is not supported under jest, matching react-native-worklets' own web build.",
	);
}
function scheduleOnRN(fn, ...args) {
	queueMicrotask(args.length ? () => fn(...args) : fn);
}
function runOnJS(fn) {
	return (...args) => scheduleOnRN(fn, ...args);
}
function runOnUIAsync(worklet, ...args) {
	return new Promise((resolve) => {
		enqueueUI(worklet, args, resolve);
	});
}

function notSimulated(name) {
	return () => {
		throw new Error(
			`[worklets-stub] \`${name}\` is native-only and not simulated. react-native-reanimated never calls it on its SHOULD_BE_USE_WEB (jest) path — if a test reaches this, it is exercising real multi-runtime worklet behaviour that this jest stub cannot provide.`,
		);
	};
}

const UIRuntimeId = 1;
const createShareable = notSimulated("createShareable");
const createSynchronizable = notSimulated("createSynchronizable");
const createWorkletRuntime = notSimulated("createWorkletRuntime");
const getUIRuntimeHolder = notSimulated("getUIRuntimeHolder");
const getUISchedulerHolder = notSimulated("getUISchedulerHolder");
const runOnRuntime = notSimulated("runOnRuntime");
const runOnRuntimeAsync = notSimulated("runOnRuntimeAsync");
const runOnRuntimeAsyncWithId = notSimulated("runOnRuntimeAsyncWithId");
const runOnRuntimeSync = notSimulated("runOnRuntimeSync");
const runOnRuntimeSyncWithId = notSimulated("runOnRuntimeSyncWithId");
const scheduleOnRuntime = notSimulated("scheduleOnRuntime");
const scheduleOnRuntimeWithId = notSimulated("scheduleOnRuntimeWithId");
const isBundleModeEnabled = () => false;
function callMicrotasks() {}
function toggleSlowAnimationsOnUIRuntime() {
	return false;
}

const WorkletsModule = {
	loadUnpackers: notSimulated("WorkletsModule.loadUnpackers"),
	getUIRuntimeHolder: notSimulated("WorkletsModule.getUIRuntimeHolder"),
	getUISchedulerHolder: notSimulated("WorkletsModule.getUISchedulerHolder"),
	toggleSlowAnimationsOnUIRuntime: () => false,
};

module.exports = {
	RuntimeKind,
	UIRuntimeId,
	WorkletsModule,
	callMicrotasks,
	createSerializable,
	createShareable,
	createSynchronizable,
	createWorkletRuntime,
	executeOnUIRuntimeSync,
	getDynamicFeatureFlag,
	getRuntimeKind,
	getStaticFeatureFlag,
	getUIRuntimeHolder,
	getUISchedulerHolder,
	isBundleModeEnabled,
	isRNRuntime,
	isSerializableRef,
	isShareable,
	isSynchronizable,
	isUIRuntime,
	isWorkerRuntime,
	isWorkletFunction,
	isWorkletRuntime,
	makeShareable,
	makeShareableCloneOnUIRecursive,
	makeShareableCloneRecursive: createSerializable,
	registerCustomSerializable,
	runOnJS,
	runOnRuntime,
	runOnRuntimeAsync,
	runOnRuntimeAsyncWithId,
	runOnRuntimeSync,
	runOnRuntimeSyncWithId,
	runOnUI,
	runOnUIAsync,
	runOnUISync,
	scheduleOnRN,
	scheduleOnRuntime,
	scheduleOnRuntimeWithId,
	scheduleOnUI,
	serializableMappingCache,
	setDynamicFeatureFlag,
	shareableMappingCache: serializableMappingCache,
	toggleSlowAnimationsOnUIRuntime,
};
