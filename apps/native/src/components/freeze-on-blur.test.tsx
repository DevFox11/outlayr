import { act, render, waitFor } from "@testing-library/react-native";
import { useSyncExternalStore } from "react";
import { Text } from "react-native";
import { FreezeOnBlur } from "./freeze-on-blur";

const mockFocus = { current: true };
const mockFocusListeners = new Set<() => void>();

jest.mock("expo-router", () => ({
	useIsFocused: () => {
		const { useSyncExternalStore: subscribeToFocus } = jest.requireActual<typeof import("react")>("react");
		return subscribeToFocus(
			(notify: () => void) => {
				mockFocusListeners.add(notify);
				return () => {
					mockFocusListeners.delete(notify);
				};
			},
			() => mockFocus.current
		);
	},
}));

async function setFocus(next: boolean) {
	mockFocus.current = next;
	await act(async () => {
		for (const notify of [...mockFocusListeners]) {
			notify();
		}
	});
	// The freeze is deferred a macrotask so it cannot land mid-transition.
	await act(async () => {
		await new Promise((resolve) => {
			setTimeout(resolve, 0);
		});
	});
}

const ticker = { listeners: new Set<() => void>(), value: "first" };

async function tick(next: string) {
	ticker.value = next;
	await act(async () => {
		for (const notify of [...ticker.listeners]) {
			notify();
		}
	});
}

let renders = 0;

function Screen() {
	const value = useSyncExternalStore(
		(notify) => {
			ticker.listeners.add(notify);
			return () => {
				ticker.listeners.delete(notify);
			};
		},
		() => ticker.value
	);
	renders += 1;
	return <Text testID="screen">{value}</Text>;
}

describe("FreezeOnBlur", () => {
	beforeEach(() => {
		mockFocus.current = true;
		mockFocusListeners.clear();
		ticker.value = "first";
		ticker.listeners.clear();
		renders = 0;
	});

	it("renders normally while the tab is focused", async () => {
		const { getByTestId } = await render(
			<FreezeOnBlur>
				<Screen />
			</FreezeOnBlur>
		);
		await waitFor(() => expect(getByTestId("screen").props.children).toBe("first"));

		await tick("second");

		expect(getByTestId("screen").props.children).toBe("second");
	});

	it("does not render the screen while the tab is blurred", async () => {
		await render(
			<FreezeOnBlur>
				<Screen />
			</FreezeOnBlur>
		);
		await setFocus(false);
		const whileBlurred = renders;

		await tick("second");
		await tick("third");

		expect(renders).toBe(whileBlurred);
	});

	it("catches up to the current value on return, without remounting", async () => {
		const { getByTestId } = await render(
			<FreezeOnBlur>
				<Screen />
			</FreezeOnBlur>
		);
		await setFocus(false);
		await tick("second");
		await tick("third");

		await setFocus(true);

		await waitFor(() => expect(getByTestId("screen").props.children).toBe("third"));
		// One catch-up render, not one per missed tick.
		expect(renders).toBe(2);
	});
});
