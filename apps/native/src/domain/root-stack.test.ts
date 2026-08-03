import { StackRouter } from "expo-router/react-navigation";
import type { RootStackGroup } from "@/domain/auth-gate";
import { ROOT_STACK_SCREEN_NAMES } from "./root-stack";

const GROUPS: readonly RootStackGroup[] = [
	"onboarding",
	"sign-in",
	"adopt",
	"ledger",
];

const EXPECTED_ROOT_SCREENS = [
	"onboarding/index",
	"onboarding/currency",
	"onboarding/rhythm",
	"auth/sign-in",
	"auth/adopt",
	"(tabs)",
	"search",
	"settings/about",
	"settings/account",
	"settings/app-icon",
	"settings/currency",
	"settings/deleted",
	"settings/erase",
	"settings/export",
	"settings/feature-lab",
	"settings/haptics",
	"settings/import",
	"settings/language",
	"settings/notifications",
	"settings/number-entry",
	"settings/sync",
	"settings/theme",
	"settings/time",
	"settings/upcoming",
	"settings/categories/index",
	"settings/categories/reorder",
	"settings/categories/create",
	"settings/categories/[categoryId]/index",
	"settings/categories/[categoryId]/subcategories/create",
	"settings/categories/[categoryId]/subcategories/[subcategoryId]",
	"settings/category-symbol",
	"transaction/new",
	"transaction/[id]",
	"transaction/identity",
];

describe("root stack total-partition invariant", () => {
	const groups = GROUPS.map((group) => ROOT_STACK_SCREEN_NAMES[group]);

	it("covers every declared root screen exactly once", () => {
		const union = groups.flat();
		expect(new Set(union)).toEqual(new Set(EXPECTED_ROOT_SCREENS));
		expect(union).toHaveLength(EXPECTED_ROOT_SCREENS.length);
	});

	it("keeps every pair of groups pairwise disjoint", () => {
		for (let i = 0; i < groups.length; i++) {
			for (let j = i + 1; j < groups.length; j++) {
				const overlap = groups[i].filter((name) => groups[j].includes(name));
				expect(overlap).toEqual([]);
			}
		}
	});

	it("never admits +not-found into any group", () => {
		for (const group of groups) {
			expect(group).not.toContain("+not-found");
		}
	});

	it("declares settings/categories/reorder under the ledger group", () => {
		expect(ROOT_STACK_SCREEN_NAMES.ledger).toContain(
			"settings/categories/reorder",
		);
	});
});

interface TestRoute {
	key: string;
	name: string;
}

interface TestStackState {
	stale: false;
	type: "stack";
	key: string;
	index: number;
	routeNames: string[];
	routes: TestRoute[];
	preloadedRoutes: TestRoute[];
}

function entryScreen(group: RootStackGroup): string {
	return ROOT_STACK_SCREEN_NAMES[group][0];
}

function beforeStackFor(group: RootStackGroup): TestRoute[] {
	const names = ROOT_STACK_SCREEN_NAMES[group];
	const entry = names[0];
	const pushed = names.includes("settings/account")
		? "settings/account"
		: names.at(-1);
	if (pushed === undefined || pushed === entry) {
		return [{ key: `${entry}-a`, name: entry }];
	}
	return [
		{ key: `${entry}-a`, name: entry },
		{ key: `${pushed}-a`, name: pushed },
	];
}

const PAIRS: [RootStackGroup, RootStackGroup][] = GROUPS.flatMap((before) =>
	GROUPS.filter((after) => after !== before).map(
		(after): [RootStackGroup, RootStackGroup] => [before, after],
	),
);

const REQUIRED_PAIRS: [RootStackGroup, RootStackGroup][] = [
	["ledger", "sign-in"],
	["ledger", "adopt"],
	["adopt", "ledger"],
	["sign-in", "ledger"],
];

describe("stack re-seating on every mode transition", () => {
	it.each(PAIRS)(
		"%s -> %s empties and re-seats on the entry screen",
		(before, after) => {
			const router = StackRouter({});
			const beforeRoutes = beforeStackFor(before);
			const state: TestStackState = {
				stale: false,
				type: "stack",
				key: "stack-test",
				index: beforeRoutes.length - 1,
				routeNames: [...ROOT_STACK_SCREEN_NAMES[before]],
				routes: beforeRoutes,
				preloadedRoutes: [],
			};

			const result = router.getStateForRouteNamesChange(state, {
				routeNames: [...ROOT_STACK_SCREEN_NAMES[after]],
				routeParamList: {},
				routeGetIdList: {},
				routeKeyChanges: [],
			});

			expect(result.routes).toHaveLength(1);
			expect(result.routes[0].name).toBe(entryScreen(after));
			expect(result.index).toBe(0);
		},
	);

	it("covers the four spec-required transitions", () => {
		for (const pair of REQUIRED_PAIRS) {
			expect(PAIRS).toContainEqual(pair);
		}
	});
});
