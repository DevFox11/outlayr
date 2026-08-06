# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Do not write comments

Default to zero comments. The code says what it does; a comment restating it is
noise that rots the moment someone edits the line above it.

Never write:

- A comment that describes what the next line does.
- A doc block on a component or function whose name and props already say it.
- Narration of a design decision, a rationale, or what you changed and why —
  that belongs in the PR description, not the source.
- Section separators, banners, or `// Handler` / `// Styles` dividers.

The only comment worth keeping records a non-obvious technical fact a reader
would otherwise get wrong: a platform bug being worked around, a constant whose
value came from measurement, an ordering that looks arbitrary but is not.
If you cannot name the concrete mistake the comment prevents, delete it.

Prefer making the code self-explanatory over explaining it. A named constant
beats a comment on a magic number; a named function beats a comment above a
block.

# The simulator is a URL

`pnpm dev` serves the running simulator at `http://localhost:8081/.sim` — live
video plus touch, keyboard, and hardware buttons. Verify a visible change there
rather than describing what it should look like.

Never run `serve-sim --kill` while the dev server is up; it kills Metro. That
trap and the rest of the limits are in `docs/simulator-preview.md`.
