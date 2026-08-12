# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# The simulator is a URL

`pnpm dev` serves the running simulator at `http://localhost:8081/.sim` — live
video plus touch, keyboard, and hardware buttons. Verify a visible change there
rather than describing what it should look like.

Never run `serve-sim --kill` while the dev server is up; it kills Metro. That
trap and the rest of the limits are in `docs/simulator-preview.md`.
