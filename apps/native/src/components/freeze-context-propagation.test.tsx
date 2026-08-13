import { act, render, screen } from "@testing-library/react-native";
import { createContext, useContext, useState } from "react";
import { Freeze } from "react-freeze";
import { Text, View } from "react-native";

/**
 * Does a context change that lands while a subtree is frozen reach every
 * consumer on thaw?
 *
 * `FreezeOnBlur` claims it does: "updates arriving during the freeze are held,
 * and the screen renders once on return with the current values". #407 says the
 * Budgets hero disagrees — a deep consumer keeps the previous locale while a
 * shallower one, in the same subtree, updates.
 *
 * The two consumers here are deliberately at different depths, because that is
 * the asymmetry the bug report describes.
 */

const LanguageContext = createContext("en");

function Shallow() {
	const language = useContext(LanguageContext);
	return <Text testID="shallow">{language}</Text>;
}

function Deep() {
	const language = useContext(LanguageContext);
	return <Text testID="deep">{language}</Text>;
}

function Parent() {
	// Reads the context itself, like `BudgetBurndownHero`, and renders a child
	// that reads it independently, like `HeroNumber`.
	const language = useContext(LanguageContext);
	return (
		<View>
			<Text testID="parent">{language}</Text>
			<Shallow />
			<View>
				<View>
					<Deep />
				</View>
			</View>
		</View>
	);
}

function Harness() {
	const [language, setLanguage] = useState("en");
	const [frozen, setFrozen] = useState(false);
	return (
		<LanguageContext.Provider value={language}>
			<Text
				onPress={() => {
					setFrozen(true);
				}}
				testID="freeze"
			>
				freeze
			</Text>
			<Text
				onPress={() => {
					setLanguage("es");
				}}
				testID="switch"
			>
				switch
			</Text>
			<Text
				onPress={() => {
					setFrozen(false);
				}}
				testID="thaw"
			>
				thaw
			</Text>
			<Freeze freeze={frozen}>
				<Parent />
			</Freeze>
		</LanguageContext.Provider>
	);
}

describe("a context change that lands while the subtree is frozen", () => {
	it("reaches every consumer once the subtree thaws", async () => {
		await act(async () => {
			render(<Harness />);
		});
		expect(screen.getByTestId("deep")).toHaveTextContent("en");

		// Freeze, change the language behind it, then come back — the Budgets tab
		// flow exactly.
		await act(async () => {
			screen.getByTestId("freeze").props.onPress();
		});
		await act(async () => {
			screen.getByTestId("switch").props.onPress();
		});
		await act(async () => {
			screen.getByTestId("thaw").props.onPress();
		});

		expect(screen.getByTestId("parent")).toHaveTextContent("es");
		expect(screen.getByTestId("shallow")).toHaveTextContent("es");
		expect(screen.getByTestId("deep")).toHaveTextContent("es");
	});
});
