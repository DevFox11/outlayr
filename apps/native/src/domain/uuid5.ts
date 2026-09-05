import { sha1 } from "@noble/hashes/legacy.js";

/**
 * RFC 4122 name-based (version 5) UUIDs. The digest comes from `@noble/hashes`
 * because it is synchronous and pure JS: `expo-crypto`'s digest is async and
 * native, and `node:crypto` cannot be imported from a module the app bundles.
 * The algorithm is fixed by the RFC, so `uuid5.test.ts` pins it against the
 * published vectors.
 */

function uuidToBytes(uuid: string): Uint8Array {
    const hex = uuid.replaceAll("-", "");
    if (hex.length !== 32) {
        throw new Error(`Not a UUID: ${uuid}`);
    }
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i += 1) {
        bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

function utf8(text: string): Uint8Array {
    // `TextEncoder` is present in Hermes and in node; the manual path exists so a
    // runtime without it still produces the SAME bytes rather than throwing,
    // because a device that computed a different id would mint a duplicate row.
    if ("TextEncoder" in globalThis) {
        return new TextEncoder().encode(text);
    }
    const bytes: number[] = [];
    for (const character of text) {
        // SAFETY: `character` comes from iterating the string, so index 0 exists;
        // `codePointAt` only answers undefined past the end.
        const point = character.codePointAt(0) as number;
        if (point < 0x80) {
            bytes.push(point);
        } else if (point < 0x8_00) {
            bytes.push(0xc0 | (point >> 6), 0x80 | (point & 0x3f));
        } else if (point < 0x1_00_00) {
            bytes.push(0xe0 | (point >> 12), 0x80 | ((point >> 6) & 0x3f), 0x80 | (point & 0x3f));
        } else {
            bytes.push(
                0xf0 | (point >> 18),
                0x80 | ((point >> 12) & 0x3f),
                0x80 | ((point >> 6) & 0x3f),
                0x80 | (point & 0x3f)
            );
        }
    }
    return new Uint8Array(bytes);
}

function format(bytes: Uint8Array): string {
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join("-");
}

/**
 * The v5 UUID for `name` within `namespace`. Same inputs, same id, on every
 * device and every run — which is the whole point of using it for a row two
 * devices may both decide to create.
 */
export function uuidV5(name: string, namespace: string): string {
    const nameBytes = utf8(name);
    const namespaceBytes = uuidToBytes(namespace);
    const input = new Uint8Array(namespaceBytes.length + nameBytes.length);
    input.set(namespaceBytes);
    input.set(nameBytes, namespaceBytes.length);

    const digest = sha1(input).slice(0, 16);
    digest[6] = (digest[6] & 0x0f) | 0x50;
    digest[8] = (digest[8] & 0x3f) | 0x80;
    return format(digest);
}
