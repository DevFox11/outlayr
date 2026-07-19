#!/usr/bin/env python3
"""Extract icon name -> codepoint mappings from the bundled Hugeicons font.

The authoritative name->glyph mapping lives in the font's GSUB ligature table
(the cmap glyph names are truncated/mangled by the font generator and must not
be trusted). This script is the provenance for every codepoint literal in
apps/ios/app/Outlayr/Models/CategoryIcon.swift: when the hugeicons-swift
package is updated, re-run it and diff the output against the catalog.

Usage:
    pip install fonttools
    python3 extract_hugeicons_codepoints.py [name ...]

With no arguments, prints every ligature name and codepoint. With arguments,
prints only those names (exiting non-zero if any is missing from the font).
"""

import sys
from pathlib import Path

from fontTools.ttLib import TTFont

FONT = (
    Path(__file__).resolve().parents[1]
    / "app/Packages/hugeicons-swift/Sources/HugeiconsSolidRounded/Fonts/hgi-solid-rounded.ttf"
)


def ligature_names(font: TTFont) -> dict[str, int]:
    cmap = font.getBestCmap()
    # Icon glyphs live in the Plane-15 PUA; everything below is the ASCII
    # "keyboard" glyphs that ligature sequences are composed from.
    pua = {}
    for codepoint, glyph in cmap.items():
        if codepoint >= 0xF0000:
            pua.setdefault(glyph, codepoint)
    charmap = {g: chr(cp) for cp, g in cmap.items() if cp < 0xF0000}

    names: dict[str, int] = {}
    for lookup in font["GSUB"].table.LookupList.Lookup:
        # Ligature subtables are wrapped in type-7 Extension lookups.
        subtables = [
            sub.ExtSubTable if lookup.LookupType == 7 else sub
            for sub in lookup.SubTable
        ]
        for sub in subtables:
            if not hasattr(sub, "ligatures"):
                continue
            for first, ligatures in sub.ligatures.items():
                for ligature in ligatures:
                    components = [first] + ligature.Component
                    try:
                        name = "".join(charmap[c] for c in components)
                    except KeyError:
                        continue
                    if ligature.LigGlyph in pua:
                        names[name] = pua[ligature.LigGlyph]
    return names


def main() -> int:
    names = ligature_names(TTFont(FONT))
    requested = sys.argv[1:]
    if not requested:
        for name in sorted(names):
            print(f"{name}\t0x{names[name]:X}")
        return 0

    missing = [name for name in requested if name not in names]
    for name in requested:
        if name in names:
            print(f"{name}\t0x{names[name]:X}")
    for name in missing:
        print(f"MISSING\t{name}", file=sys.stderr)
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
