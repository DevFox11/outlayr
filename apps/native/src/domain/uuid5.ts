/**
 * RFC 4122 name-based (version 5) UUIDs, implemented here rather than taken
 * from a dependency because both runtimes this code has to work in are awkward:
 * `expo-crypto`'s digest is async and native, and `node:crypto` cannot be
 * imported from a module the app bundles. The algorithm is fixed by the RFC, so
 * `uuid5.test.ts` pins it against the published vectors.
 */

function rotl(value: number, by: number): number {
    return ((value << by) | (value >>> (32 - by))) >>> 0;
}

function sha1(bytes: Uint8Array): Uint8Array {
    const bitLength = bytes.length * 8;
    const padded = new Uint8Array((((bytes.length + 8) >> 6) + 1) << 6);
    padded.set(bytes);
    padded[bytes.length] = 0x80;

    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 8, Math.floor(bitLength / 0x1_00_00_00_00));
    view.setUint32(padded.length - 4, bitLength >>> 0);

    let h0 = 0x67_45_23_01;
    let h1 = 0xef_cd_ab_89;
    let h2 = 0x98_ba_dc_fe;
    let h3 = 0x10_32_54_76;
    let h4 = 0xc3_d2_e1_f0;

    const w = new Uint32Array(80);

    for (let chunk = 0; chunk < padded.length; chunk += 64) {
        for (let i = 0; i < 16; i += 1) {
            w[i] = view.getUint32(chunk + i * 4);
        }
        for (let i = 16; i < 80; i += 1) {
            w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
        }

        let a = h0;
        let b = h1;
        let c = h2;
        let d = h3;
        let e = h4;

        for (let i = 0; i < 80; i += 1) {
            let f: number;
            let k: number;
            if (i < 20) {
                f = (b & c) | (~b & d);
                k = 0x5a_82_79_99;
            } else if (i < 40) {
                f = b ^ c ^ d;
                k = 0x6e_d9_eb_a1;
            } else if (i < 60) {
                f = (b & c) | (b & d) | (c & d);
                k = 0x8f_1b_bc_dc;
            } else {
                f = b ^ c ^ d;
                k = 0xca_62_c1_d6;
            }
            const temp = (rotl(a, 5) + f + e + k + w[i]) >>> 0;
            e = d;
            d = c;
            c = rotl(b, 30);
            b = a;
            a = temp;
        }

        h0 = (h0 + a) >>> 0;
        h1 = (h1 + b) >>> 0;
        h2 = (h2 + c) >>> 0;
        h3 = (h3 + d) >>> 0;
        h4 = (h4 + e) >>> 0;
    }

    const digest = new Uint8Array(20);
    const out = new DataView(digest.buffer);
    out.setUint32(0, h0);
    out.setUint32(4, h1);
    out.setUint32(8, h2);
    out.setUint32(12, h3);
    out.setUint32(16, h4);
    return digest;
}

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
    if (typeof TextEncoder !== "undefined") {
        return new TextEncoder().encode(text);
    }
    const bytes: number[] = [];
    for (const character of text) {
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
