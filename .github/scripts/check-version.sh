#!/usr/bin/env bash
# Fails when the tag version (<sdk>/vX.Y.Z) differs from the version in the manifest.
# usage: check-version.sh <manifest version>
set -euo pipefail
tag_version="${GITHUB_REF_NAME##*/v}"
if [ "$tag_version" != "$1" ]; then
  echo "::error::Tag $GITHUB_REF_NAME is version $tag_version, the manifest says $1. Bump the manifest first."
  exit 1
fi
echo "Releasing version $tag_version"
