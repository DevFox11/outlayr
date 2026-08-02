import { render } from "@testing-library/react-native";
import { createRef } from "react";
import type { Text as RNText } from "react-native";
import { Text } from "./text";

describe("Text", () => {
	it("lands ref on the underlying RNText child", async () => {
		const ref = createRef<RNText>();
		await render(<Text ref={ref}>hello</Text>);
		expect(ref.current).toBeTruthy();
	});
});
