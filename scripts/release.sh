#!/usr/bin/env bash
# Releases every SDK with the same version: checks that main is clean and up to date, that each
# file in versions.sh holds the version and that no tag exists yet, then pushes one tag per
# release workflow (<prefix>/vX.Y.Z).
# usage: scripts/release.sh 0.2.0 [--dry-run]
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/versions.sh

version="${1:-}"
dry_run="${2:-}"
if [ -z "$version" ]; then
  echo "usage: scripts/release.sh X.Y.Z [--dry-run]" >&2
  exit 1
fi

fail() { echo "error: $*" >&2; exit 1; }

git fetch --quiet --tags origin main
[ "$(git rev-parse --abbrev-ref HEAD)" = main ] || fail "check out main first"
[ -z "$(git status --porcelain --untracked-files=no)" ] || fail "commit or stash your changes first"
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || fail "main differs from origin/main"

wrong="$(read_versions | awk -v v="$version" '$2 != v')"
[ -z "$wrong" ] || fail "these files are not at $version (run scripts/set-version.sh $version and merge it):
$wrong"

for prefix in "${RELEASE_PREFIXES[@]}"; do
  tag="$prefix/v$version"
  if git rev-parse -q --verify "refs/tags/$tag" >/dev/null || git ls-remote --exit-code --tags origin "refs/tags/$tag" >/dev/null; then
    fail "tag $tag already exists"
  fi
done

commit="$(git rev-parse --short HEAD)"
echo "Releasing $version from $commit:"
for prefix in "${RELEASE_PREFIXES[@]}"; do
  tag="$prefix/v$version"
  echo "  $tag"
  [ "$dry_run" = --dry-run ] && continue
  git tag "$tag" HEAD
  # One push per tag: GitHub starts no workflow for a push that creates more than 3 tags.
  git push --quiet origin "refs/tags/$tag"
done

[ "$dry_run" = --dry-run ] && echo "Dry run: no tag created." || echo "Done. Follow the runs at https://github.com/zapz-api/zapz-sdk/actions"
