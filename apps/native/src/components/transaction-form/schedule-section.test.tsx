import { describe, expect, it } from "@jest/globals";
import { render } from "@testing-library/react-native";

import { TransactionFormScheduleSection } from "./schedule-section";

interface JsonNode {
    children: (JsonNode | string)[] | null;
    props: Record<string, unknown>;
    type: string;
}

function findByProp(node: JsonNode | JsonNode[] | null, key: string, value: unknown): JsonNode | null {
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
    { label: "Daily", type: 1 },
    { label: "Weekly", type: 2 },
    { label: "Monthly", type: 3 },
    { label: "Yearly", type: 4 },
];

const LEAD_OPTIONS = [
    { label: "On the day", lead: 0 },
    { label: "1 day before", lead: 1 },
    { label: "1 week before", lead: 7 },
];

const BASE_PROPS = {
    cadenceOptions: CADENCE_OPTIONS,
    card: [],
    customScheduleLabel: "Custom…",
    date: new Date(2026, 2, 10),
    dateLabel: "Date",
    endDate: new Date(2026, 5, 10),
    endDateLabel: "End date",
    endsLabel: "Ends",
    firstPaymentLabel: "First payment",
    foregroundColor: "#111111",
    hairline: [],
    hasEndDate: false,
    incomeColor: "#00AA00",
    leadDays: null,
    leadOffLabel: "Off",
    leadOffTag: -1,
    leadOptions: LEAD_OPTIONS,
    mutedColor: "#999999",
    onDateChange: () => {},
    onEndDateChange: () => {},
    onHasEndDateChange: () => {},
    onLeadChange: () => {},
    onOpenCustomSchedule: () => {},
    onScheduleChange: () => {},
    recurringType: 3,
    remindLabel: "Remind",
    remindMenuLabel: "No reminder set",
    scheduleLabel: "Schedule",
    scheduleMenuLabel: "Every month",
    timeLabel: "Time",
};

describe("transactionFormScheduleSection — subscription branch", () => {
    it("renders the schedule, first payment, end date and remind rows", async () => {
        const { toJSON } = await render(<TransactionFormScheduleSection {...BASE_PROPS} isSubscription />);
        const tree = toJSON() as JsonNode;
        expect(findByProp(tree, "text", "Schedule")).not.toBeNull();
        expect(findByProp(tree, "text", "Every month")).not.toBeNull();
        expect(findByProp(tree, "text", "First payment")).not.toBeNull();
        expect(findByProp(tree, "text", "End date")).not.toBeNull();
        expect(findByProp(tree, "text", "Remind")).not.toBeNull();
        expect(findByProp(tree, "text", "No reminder set")).not.toBeNull();
    });

    it("does not render the once-off date/time rows", async () => {
        const { toJSON } = await render(<TransactionFormScheduleSection {...BASE_PROPS} isSubscription />);
        const tree = toJSON() as JsonNode;
        expect(findByProp(tree, "text", "Date")).toBeNull();
        expect(findByProp(tree, "text", "Time")).toBeNull();
    });

    it("renders every cadence option with its own tag and translated label", async () => {
        const { toJSON } = await render(<TransactionFormScheduleSection {...BASE_PROPS} isSubscription />);
        const tree = toJSON() as JsonNode;
        for (const option of CADENCE_OPTIONS) {
            const node = findByProp(tree, "text", option.label);
            expect(node).not.toBeNull();
            const modifiers = node?.props.modifiers as {
                $type: string;
                tag: unknown;
            }[];
            expect(modifiers.some((m) => m.$type === "tag" && m.tag === option.type)).toBe(true);
        }
    });

    it("hides the ends row when there is no end date", async () => {
        const { toJSON } = await render(
            <TransactionFormScheduleSection {...BASE_PROPS} hasEndDate={false} isSubscription />
        );
        expect(findByProp(toJSON() as JsonNode, "text", "Ends")).toBeNull();
    });

    it("shows the ends row when there is an end date", async () => {
        const { toJSON } = await render(<TransactionFormScheduleSection {...BASE_PROPS} hasEndDate isSubscription />);
        expect(findByProp(toJSON() as JsonNode, "text", "Ends")).not.toBeNull();
    });

    it("renders the off sentinel and every lead option with its own tag", async () => {
        const { toJSON } = await render(<TransactionFormScheduleSection {...BASE_PROPS} isSubscription />);
        const tree = toJSON() as JsonNode;
        const offNode = findByProp(tree, "text", "Off");
        expect(offNode).not.toBeNull();
        const offModifiers = offNode?.props.modifiers as {
            $type: string;
            tag: unknown;
        }[];
        expect(offModifiers.some((m) => m.$type === "tag" && m.tag === -1)).toBe(true);
        for (const option of LEAD_OPTIONS) {
            const node = findByProp(tree, "text", option.label);
            expect(node).not.toBeNull();
        }
    });

    it("carries the income color into the end-date toggle's tint", async () => {
        const { toJSON } = await render(<TransactionFormScheduleSection {...BASE_PROPS} isSubscription />);
        expect(JSON.stringify(toJSON())).toContain('"$type":"tint","color":"#00AA00"');
    });
});

describe("transactionFormScheduleSection — once-off branch", () => {
    it("renders the date and time rows and not the subscription rows", async () => {
        const { toJSON } = await render(<TransactionFormScheduleSection {...BASE_PROPS} isSubscription={false} />);
        const tree = toJSON() as JsonNode;
        expect(findByProp(tree, "text", "Date")).not.toBeNull();
        expect(findByProp(tree, "text", "Time")).not.toBeNull();
        expect(findByProp(tree, "text", "Schedule")).toBeNull();
        expect(findByProp(tree, "text", "Remind")).toBeNull();
    });
});
