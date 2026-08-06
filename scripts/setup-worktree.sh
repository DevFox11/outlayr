#!/usr/bin/env sh
set -eu

main_root="${T3CODE_PROJECT_ROOT:-$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")}"
worktree_root="$(git rev-parse --show-toplevel)"

seed() {
	src="$main_root/$1"
	dst="$worktree_root/$1"

	if [ ! -e "$src" ]; then
		echo "skip    $1 (missing in $main_root)"
		return 0
	fi

	if [ -e "$dst" ]; then
		echo "keep    $1 (already present)"
		return 0
	fi

	mkdir -p "$(dirname "$dst")"
	# -c clones on APFS: the 112M .convex deployment costs no disk until written to.
	cp -Rc "$src" "$dst" 2>/dev/null || cp -R "$src" "$dst"
	echo "seeded  $1"
}

if [ "$main_root" != "$worktree_root" ]; then
	seed apps/native/.env
	seed packages/backend/.env.local
	seed packages/backend/.convex
fi

pnpm install
