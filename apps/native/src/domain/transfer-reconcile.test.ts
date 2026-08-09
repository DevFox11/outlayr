import { solveTransfer, type TransferValues, transferDisplay, transferGap, transferLegs } from "./transfer-reconcile";

const VES_DECIMALS = 2;
const USD_DECIMALS = 2;

function sourceFeeCase(overrides: Partial<TransferValues> = {}): TransferValues {
	return { arrived: 5400.15, fee: 2.7, feeSide: "source", rate: 55.5, sent: 100, ...overrides };
}

function destFeeCase(overrides: Partial<TransferValues> = {}): TransferValues {
	return { arrived: 5400, fee: 150, feeSide: "destination", rate: 55.5, sent: 100, ...overrides };
}

describe("solveTransfer with a source-side fee", () => {
	it("solves the arrival from what was sent, the fee and the rate", () => {
		expect(solveTransfer(sourceFeeCase(), "arrived", VES_DECIMALS)).toBe(5400.15);
	});

	it("solves what was sent from the arrival", () => {
		expect(solveTransfer(sourceFeeCase(), "sent", USD_DECIMALS)).toBe(100);
	});

	it("solves the fee from the shortfall against the rate", () => {
		expect(solveTransfer(sourceFeeCase(), "fee", USD_DECIMALS)).toBe(2.7);
	});

	it("solves the rate from the converted portion, not the total debited", () => {
		expect(solveTransfer(sourceFeeCase(), "rate", USD_DECIMALS)).toBeCloseTo(55.5, 9);
	});
});

describe("solveTransfer with a destination-side fee", () => {
	it("solves the arrival by deducting the fee after conversion", () => {
		expect(solveTransfer(destFeeCase(), "arrived", VES_DECIMALS)).toBe(5400);
	});

	it("solves what was sent from the arrival plus the fee", () => {
		expect(solveTransfer(destFeeCase(), "sent", USD_DECIMALS)).toBe(100);
	});

	it("solves the fee in the destination currency", () => {
		expect(solveTransfer(destFeeCase(), "fee", VES_DECIMALS)).toBe(150);
	});

	it("solves the rate from the pre-fee arrival", () => {
		expect(solveTransfer(destFeeCase(), "rate", VES_DECIMALS)).toBeCloseTo(55.5, 9);
	});
});

describe("solveTransfer without a fee", () => {
	const noFee: TransferValues = { arrived: 5550, fee: 0, feeSide: "source", rate: 55.5, sent: 100 };

	it("reduces to a plain conversion", () => {
		expect(solveTransfer(noFee, "arrived", VES_DECIMALS)).toBe(5550);
	});

	it("agrees with the destination side when there is nothing to charge", () => {
		expect(solveTransfer({ ...noFee, feeSide: "destination" }, "arrived", VES_DECIMALS)).toBe(5550);
	});
});

describe("solveTransfer at rate 1", () => {
	it("handles a same-currency wire with a flat source fee", () => {
		const wire: TransferValues = { arrived: 0, fee: 25, feeSide: "source", rate: 1, sent: 500 };
		expect(solveTransfer(wire, "arrived", USD_DECIMALS)).toBe(475);
	});

	it("handles a same-currency wire charged on the receiving side", () => {
		const wire: TransferValues = { arrived: 0, fee: 25, feeSide: "destination", rate: 1, sent: 500 };
		expect(solveTransfer(wire, "arrived", USD_DECIMALS)).toBe(475);
	});
});

describe("solveTransfer refuses the unanswerable", () => {
	it("returns null when the rate is zero and the arrival cannot be divided by it", () => {
		expect(solveTransfer(sourceFeeCase({ rate: 0 }), "sent", USD_DECIMALS)).toBeNull();
	});

	it("returns null when the fee consumes everything sent, leaving no rate to derive", () => {
		expect(solveTransfer(sourceFeeCase({ fee: 100, sent: 100 }), "rate", USD_DECIMALS)).toBeNull();
	});

	it("returns null deriving a rate from nothing sent", () => {
		expect(solveTransfer(destFeeCase({ sent: 0 }), "rate", VES_DECIMALS)).toBeNull();
	});

	it("returns null when a source fee exceeds what was sent", () => {
		expect(solveTransfer(sourceFeeCase({ fee: 150, sent: 100 }), "arrived", VES_DECIMALS)).toBeNull();
	});

	it("returns null when a destination fee exceeds the converted amount", () => {
		expect(solveTransfer(destFeeCase({ fee: 99_999 }), "arrived", VES_DECIMALS)).toBeNull();
	});

	it("returns null rather than a non-finite figure", () => {
		expect(solveTransfer(sourceFeeCase({ rate: Number.POSITIVE_INFINITY }), "arrived", VES_DECIMALS)).toBeNull();
	});
});

describe("transferLegs stores movement and leaves the fee outside", () => {
	it("shrinks the outbound leg by a source-side fee", () => {
		expect(transferLegs(sourceFeeCase(), USD_DECIMALS, VES_DECIMALS)).toEqual({
			exchangeRate: 55.5,
			fromAmount: 97.3,
			toAmount: 5400.15,
		});
	});

	it("grows the inbound leg by a destination-side fee", () => {
		expect(transferLegs(destFeeCase(), USD_DECIMALS, VES_DECIMALS)).toEqual({
			exchangeRate: 55.5,
			fromAmount: 100,
			toAmount: 5550,
		});
	});

	it("keeps the legs a pure conversion of each other on both sides", () => {
		for (const values of [sourceFeeCase(), destFeeCase()]) {
			const legs = transferLegs(values, USD_DECIMALS, VES_DECIMALS);
			expect(legs).not.toBeNull();
			expect(
				(legs as NonNullable<typeof legs>).fromAmount * (legs as NonNullable<typeof legs>).exchangeRate
			).toBeCloseTo((legs as NonNullable<typeof legs>).toAmount, 6);
		}
	});

	it("refuses a transfer whose source fee is the whole amount", () => {
		expect(transferLegs(sourceFeeCase({ fee: 100, sent: 100 }), USD_DECIMALS, VES_DECIMALS)).toBeNull();
	});
});

describe("transferDisplay recomposes what the user typed", () => {
	it("adds a source-side fee back onto the outbound leg", () => {
		expect(transferDisplay({ exchangeRate: 55.5, fromAmount: 97.3, toAmount: 5400.15 }, 2.7, "source")).toEqual({
			arrived: 5400.15,
			sent: 100,
		});
	});

	it("deducts a destination-side fee from the inbound leg", () => {
		expect(transferDisplay({ exchangeRate: 55.5, fromAmount: 100, toAmount: 5550 }, 150, "destination")).toEqual({
			arrived: 5400,
			sent: 100,
		});
	});

	it("round-trips through transferLegs on both sides", () => {
		for (const values of [sourceFeeCase(), destFeeCase()]) {
			const legs = transferLegs(values, USD_DECIMALS, VES_DECIMALS);
			const shown = transferDisplay(legs as NonNullable<typeof legs>, values.fee, values.feeSide);
			expect(shown.sent).toBeCloseTo(values.sent, 6);
			expect(shown.arrived).toBeCloseTo(values.arrived, 6);
		}
	});
});

describe("transferGap surfaces the unexplained difference", () => {
	it("reports the shortfall when an arrival disagrees with the rate", () => {
		const values: TransferValues = { arrived: 5400, fee: 0, feeSide: "source", rate: 55.5, sent: 100 };
		expect(transferGap(values, VES_DECIMALS)).toBe(150);
	});

	it("reports nothing when the numbers already reconcile", () => {
		expect(transferGap(sourceFeeCase(), VES_DECIMALS)).toBe(0);
	});

	it("reports nothing on a reconciled destination-side fee", () => {
		expect(transferGap(destFeeCase(), VES_DECIMALS)).toBe(0);
	});

	it("reports a negative gap when more arrived than the rate predicts", () => {
		const values: TransferValues = { arrived: 5600, fee: 0, feeSide: "source", rate: 55.5, sent: 100 };
		expect(transferGap(values, VES_DECIMALS)).toBe(-50);
	});
});
