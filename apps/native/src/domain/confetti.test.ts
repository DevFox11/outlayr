import { describe, expect, it } from "@jest/globals";

import { CONFETTI_FLIGHT_MS, confettiBurst } from "./confetti";

describe("confetti burst", () => {
    it("emits exactly the requested number of pieces", () => {
        expect(confettiBurst(24, 4, 1)).toHaveLength(24);
        expect(confettiBurst(1, 4, 1)).toHaveLength(1);
    });

    it("gives each piece of a burst a distinct key", () => {
        const ids = confettiBurst(30, 4, 2).map((piece) => piece.id);
        expect(new Set(ids).size).toBe(30);
    });

    it("emits nothing for a non-positive count", () => {
        expect(confettiBurst(0, 4, 1)).toStrictEqual([]);
        expect(confettiBurst(-3, 4, 1)).toStrictEqual([]);
    });

    it("is deterministic for a seed, so a re-render never reshuffles a burst", () => {
        expect(confettiBurst(20, 5, 7)).toStrictEqual(confettiBurst(20, 5, 7));
    });

    it("gives a different seed a different burst", () => {
        expect(confettiBurst(20, 5, 7)).not.toStrictEqual(confettiBurst(20, 5, 8));
    });

    it("launches every piece inside the burst width", () => {
        for (const piece of confettiBurst(60, 5, 3)) {
            expect(piece.x >= 0 && piece.x <= 1).toBeTruthy();
        }
    });

    it("indexes colours inside the palette it was given", () => {
        for (const piece of confettiBurst(60, 5, 3)) {
            expect(Number.isInteger(piece.colorIndex)).toBeTruthy();
            expect(piece.colorIndex >= 0 && piece.colorIndex < 5).toBeTruthy();
        }
        for (const piece of confettiBurst(10, 1, 3)) {
            expect(piece.colorIndex).toBe(0);
        }
    });

    it("uses every colour of a small palette across a wide burst", () => {
        const used = new Set(confettiBurst(60, 4, 11).map((piece) => piece.colorIndex));
        expect([...used].sort()).toStrictEqual([0, 1, 2, 3]);
    });

    it("throws every piece up before it falls past the launch point", () => {
        for (const piece of confettiBurst(60, 5, 5)) {
            expect(piece.rise > 0).toBeTruthy();
            expect(piece.fall > piece.rise).toBeTruthy();
        }
    });

    it("lands every piece within the flight budget", () => {
        for (const piece of confettiBurst(60, 5, 5)) {
            expect(piece.delayMs >= 0).toBeTruthy();
            expect(piece.durationMs > 0).toBeTruthy();
            expect(piece.delayMs + piece.durationMs <= CONFETTI_FLIGHT_MS).toBeTruthy();
        }
    });

    it("spins pieces both ways", () => {
        const spins = confettiBurst(60, 5, 9).map((piece) => piece.spin);
        expect(spins.some((spin) => spin > 0)).toBeTruthy();
        expect(spins.some((spin) => spin < 0)).toBeTruthy();
    });
});
