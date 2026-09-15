import { formatDayHeader } from "./dates";

const parts = process.argv.slice(2).map(Number);

function localDate(offset: number): Date {
    return new Date(
        parts[offset] ?? 0,
        parts[offset + 1] ?? 0,
        parts[offset + 2] ?? 1,
        parts[offset + 3] ?? 0,
        parts[offset + 4] ?? 0
    );
}

process.stdout.write(formatDayHeader(localDate(0), localDate(5), "en"));
