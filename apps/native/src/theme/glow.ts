/**
 * Dominant hues for the `IdentityCurtain` mesh, extracted natively at runtime
 * (the Swift `EmojiGlow` histogram). One algorithm, two sources: `glowFromEmoji`
 * rasterizes a glyph (sync), `glowFromImage` decodes a photo (async). Both
 * return up-to-two `#RRGGBB` hues, or `[]` when the native module is
 * unavailable — the form then washes the mesh in the tint alone.
 */
export { glowFromEmoji, glowFromImage } from "../../modules/glow";
