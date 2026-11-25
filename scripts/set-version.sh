#!/usr/bin/env bash
# Sets the version of the given SDKs (every SDK when none is given) in their manifests and in the
# VERSION constant each client sends.
# usage: scripts/set-version.sh 0.2.0 [sdk...]     e.g. scripts/set-version.sh 0.1.6 node mcp
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/versions.sh

version="${1:-}"
if ! [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]]; then
  echo "usage: scripts/set-version.sh X.Y.Z [sdk...]   (sdks: ${RELEASE_PREFIXES[*]})" >&2
  exit 1
fi
shift
for sdk in "$@"; do
  [[ " ${RELEASE_PREFIXES[*]} " == *" $sdk "* ]] || { echo "unknown sdk: $sdk" >&2; exit 1; }
done

for entry in "${VERSION_FILES[@]}"; do
  file="${entry%%|*}"
  if [ "$#" -gt 0 ] && ! [[ " $* " == *" ${file%%/*} "* ]]; then continue; fi
  REGEX="${entry#*|}" VERSION="$version" perl -0pi -e '
    my $r = $ENV{REGEX};
    s/$r/$1$ENV{VERSION}$2/m or die "no version line in $ARGV\n";
  ' "$file"
done

read_versions "$@" | column -t
