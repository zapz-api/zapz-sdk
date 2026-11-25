#!/usr/bin/env bash
# Sets one version in every SDK manifest and in the VERSION constant each client sends.
# usage: scripts/set-version.sh 0.2.0
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/versions.sh

version="${1:-}"
if ! [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]]; then
  echo "usage: scripts/set-version.sh X.Y.Z" >&2
  exit 1
fi

for entry in "${VERSION_FILES[@]}"; do
  file="${entry%%|*}"
  REGEX="${entry#*|}" VERSION="$version" perl -0pi -e '
    my $r = $ENV{REGEX};
    s/$r/$1$ENV{VERSION}$2/m or die "no version line in $ARGV\n";
  ' "$file"
done

read_versions | column -t
