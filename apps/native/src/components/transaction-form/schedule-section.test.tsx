import { render } from "@testing-library/react-native";
import { TransactionFormScheduleSection } from "./schedule-section";

interface JsonNode {
	type: string;
	props: Record<string, unknown>;
	children: (JsonNode | string)[] | null;
}

function findByProp(
	node: JsonNode | JsonNode[] | null,
	key: string,
	value: unknown,
): JsonNode | null {
	if (node == null) {
		return null;
	}
	if (Array.isArray(node)) {
		for (const child of node) {
			const found = findByProp(child, key, value);
			if (found) {
				return found;
			}
		}
		return null;
	}
	if (node.props?.[key] === value) {
		return node;
	}
	for (const child of node.children ?? []) {
		if (typeof child === "string") {
			continue;
		}
		const found = findByProp(child, key, value);
		if (found) {
			return found;
		}
	}
	return null;
}

const CADENCE_OPTIONS = [
	{ type: 1, label: "Daily" },
	{ type: 2, label: "Weekly" },
	{ type: 3, label: "Monthly" },
	{ type: 4, label: "Yearly" },
];

const LEAD_OPTIONS = [
	{ lead: 0, label: "On the day" },
	{ lead: 1, label: "1 day before" },
	{ lead: 7, label: "1 week before" },
];

const BASE_PROPS = {
	card: [],
	hairline: [],
	foregroundColor: "#111111",
	mutedColor: "#999999",
	incomeColor: "#00AA00",
	cadenceOptions: CADENCE_OPTIONS,
	recurringType: 3,
	onScheduleChange: () => {},
	customScheduleLabel: "Custom…",
	onOpenCustomSchedule: () => {},
	scheduleLabel: "Schedule",
	scheduleMenuLabel: "Every month",
	firstPaymentLabel: "First payment",
	date: new Date(2026, 2, 10),
	onDateChange: () => {},
	endDateLabel: "End date",
	hasEndDate: false,
	onHasEndDateChange: () => {},
	endsLabel: "Ends",
	endDate: new Date(2026, 5, 10),
	onEndDateChange: () => {},
	remindLabel: "Remind",
	remindMenuLabel: "No reminder set",
	leadDays: null,
	leadOffTag: -1,
	leadOffLabel: "Off",
	leadOptions: LEAD_OPTIONS,
	onLeadChange: () => {},
	dateLabel: "Date",
	timeLabel: "Time",
};

describe("TransactionFormScheduleSection — subscription branch", () => {
	it("renders the schedule, first payment, end date and remind rows", async () => {
		const { toJSON } = await render(
			<TransactionFormScheduleSection {...BASE_PROPS} isSubscription />,
		);
		const tree = toJSON() as JsonNode;
		expect(findByProp(tree, "text", "Schedule")).not.toBeNull();
		expect(findByProp(tree, "text", "Every month")).not.toBeNull();
		expect(findByProp(tree, "text", "First payment")).not.toBeNull();
		expect(findByProp(tree, "text", "End date")).not.toBeNull();
		expect(findByProp(tree, "text", "Remind")).not.toBeNull();
		expect(findByProp(tree, "text", "No reminder set")).not.toBeNull();
	});

	it("does not render the once-off date/time rows", async () => {
		const { toJSON } = await render(
			<TransactionFormScheduleSection {...BASE_PROPS} isSubscription />,
		);
		const tree = toJSON() as JsonNode;
		expect(findByProp(tree, "text", "Date")).toBeNull();
		expect(findByProp(tree, "text", "Time")).toBeNull();
	});

	it("renders every cadence option with its own tag and translated label", async () => {
		const { toJSON } = await render(
			<TransactionFormScheduleSection {...BASE_PROPS} isSubscription />,
		);
		const tree = toJSON() as JsonNode;
		for (const option of CADENCE_OPTIONS) {
			const node = findByProp(tree, "text", option.label);
			expect(node).not.toBeNull();
			const modifiers = node?.props.modifiers as {
				$type: string;
				tag: unknown;
			}[];
			expect(
				modifiers.some((m) => m.$type === "tag" && m.tag === option.type),
			).toBe(true);
		}
	});

	it("hides the ends row when there is no end date", async () => {
		const { toJSON } = await render(
			<TransactionFormScheduleSection
				{...BASE_PROPS}
				hasEndDate={false}
				isSubscription
			/>,
		);
		expect(findByProp(toJSON() as JsonNode, "text", "Ends")).toBeNull();
	});

	it("shows the ends row when there is an end date", async () => {
		const { toJSON } = await render(
			<TransactionFormScheduleSection
				{...BASE_PROPS}
				hasEndDate
				isSubscription
			/>,
		);
		expect(findByProp(toJSON() as JsonNode, "text", "Ends")).not.toBeNull();
	});

	it("renders the off sentinel and every lead option with its own tag", async () => {
		const { toJSON } = await render(
			<TransactionFormScheduleSection {...BASE_PROPS} isSubscription />,
		);
		const tree = toJSON() as JsonNode;
		const offNode = findByProp(tree, "text", "Off");
		expect(offNode).not.toBeNull();
		const offModifiers = offNode?.props.modifiers as {
			$type: string;
			tag: unknown;
		}[];
		expect(offModifiers.some((m) => m.$type === "tag" && m.tag === -1)).toBe(
			true,
		);
		for (const option of LEAD_OPTIONS) {
			const node = findByProp(tree, "text", option.label);
			expect(node).not.toBeNull();
		}
	});

	it("carries the income color into the end-date toggle's tint", async () => {
		const { toJSON } = await render(
			<TransactionFormScheduleSection {...BASE_PROPS} isSubscription />,
		);
		expect(JSON.stringify(toJSON())).toContain(
			'"$type":"tint","color":"#00AA00"',
		);
	});
});

describe("TransactionFormScheduleSection — once-off branch", () => {
	it("renders the date and time rows and not the subscription rows", async () => {
		const { toJSON } = await render(
			<TransactionFormScheduleSection {...BASE_PROPS} isSubscription={false} />,
		);
		const tree = toJSON() as JsonNode;
		expect(findByProp(tree, "text", "Date")).not.toBeNull();
		expect(findByProp(tree, "text", "Time")).not.toBeNull();
		expect(findByProp(tree, "text", "Schedule")).toBeNull();
		expect(findByProp(tree, "text", "Remind")).toBeNull();
	});
});
