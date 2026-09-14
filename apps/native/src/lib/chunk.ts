export function chunkRows<T>(rows: readonly T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let start = 0; start < rows.length; start += size) {
        chunks.push(rows.slice(start, start + size));
    }
    return chunks;
}
