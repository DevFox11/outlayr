<!--
Title must follow Conventional Commits: type(scope): description
e.g. feat(native): rework the categories toolbar
-->

## Type

Check exactly one, and add the matching `type:*` label.

- [ ] Bug fix — `type:bug`
- [ ] New feature — `type:feature`
- [ ] Documentation only — `type:docs`
- [ ] Refactor (no behaviour change) — `type:refactor`
- [ ] Maintenance / tooling — `type:chore`
- [ ] Breaking change — `type:breaking-change`

## Summary

<!-- 1-3 bullets: what this does and why. The diff already shows the what; explain the why. -->

-

## Changes

| File | Change |
|------|--------|
|      |        |

## Behaviour changes

<!--
Anything a user or another developer would notice that is NOT obvious from the diff:
removed capabilities, changed defaults, altered edge cases. Write "None" if there are none.
Silent behaviour changes are the ones that hurt six months from now.
-->

None

## Test plan

- [ ] Builds clean
- [ ] Manually verified the affected flow
- [ ] Noted anything left unverified (devices, OS versions, edge cases)

## Checklist

- [ ] Added exactly one `type:*` label
- [ ] Conventional commit format on every commit
- [ ] No `Co-Authored-By` or AI attribution trailers
