#!/usr/bin/env bash
# Releases only the SDKs that changed since their last tag and got a new version. For each SDK whose
# folder differs from its latest <sdk>/vX.Y.Z tag and whose files (set with set-version.sh) hold a
# version with no tag yet, it pushes <sdk>/v<that version>. An SDK that changed but keeps its
# version (a README fix, say) is skipped with a warning.
# usage: scripts/release.sh [--dry-run] [sdk...]   (no sdk = every changed SDK)
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/versions.sh

dry_run=""
sdks=()
for arg in "$@"; do
  case "$arg" in
    --dry-run) dry_run=1 ;;
    *) [[ " ${RELEASE_PREFIXES[*]} " == *" $arg "* ]] || { echo "unknown sdk: $arg" >&2; exit 1; }
       sdks+=("$arg") ;;
  esac
done
[ "${#sdks[@]}" -gt 0 ] || sdks=("${RELEASE_PREFIXES[@]}")

fail() { echo "error: $*" >&2; exit 1; }

git fetch --quiet --tags origin main
[ "$(git rev-parse --abbrev-ref HEAD)" = main ] || fail "check out main first"
[ -z "$(git status --porcelain --untracked-files=no)" ] || fail "commit or stash your changes first"
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || fail "main differs from origin/main"

releases=()
problems=()
for sdk in "${sdks[@]}"; do
  last_tag="$(git tag --list "$sdk/v*" --sort=-v:refname | head -n 1)"
  if [ -n "$last_tag" ] && git diff --quiet "$last_tag" HEAD -- "$sdk"; then
    echo "  $sdk: unchanged since $last_tag, skipped"
    continue
  fi
  versions="$(read_versions "$sdk" | awk '{print $2}' | sort -u)"
  if [ "$(echo "$versions" | wc -l)" -ne 1 ]; then
    problems+=("$sdk: its files hold different versions ($(echo "$versions" | paste -sd' ')); run scripts/set-version.sh X.Y.Z $sdk")
    continue
  fi
  tag="$sdk/v$versions"
  if git rev-parse -q --verify "refs/tags/$tag" >/dev/null || git ls-remote --exit-code --tags origin "refs/tags/$tag" >/dev/null; then
    echo "  $sdk: changed since $last_tag but still at $versions, skipped (to release it: scripts/set-version.sh X.Y.Z $sdk)"
    continue
  fi
  releases+=("$tag")
done

[ "${#problems[@]}" -eq 0 ] || fail "nothing was tagged:
$(printf '  %s\n' "${problems[@]}")"
[ "${#releases[@]}" -gt 0 ] || { echo "Nothing to release."; exit 0; }

echo "Releasing from $(git rev-parse --short HEAD):"
for tag in "${releases[@]}"; do
  echo "  $tag"
  [ -n "$dry_run" ] && continue
  git tag "$tag" HEAD
  # One push per tag: GitHub starts no workflow for a push that creates more than 3 tags.
  git push --quiet origin "refs/tags/$tag"
done

[ -n "$dry_run" ] && echo "Dry run: no tag created." || echo "Done. Follow the runs at https://github.com/zapz-api/zapz-sdk/actions"
