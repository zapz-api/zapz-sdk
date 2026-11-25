# shellcheck shell=bash
# Every file that holds the SDK version, with a Perl regex whose group 1 is the text before
# the version and group 2 the text after it. Sourced by set-version.sh and release.sh.
# shellcheck disable=SC2034
VERSION_FILES=(
  'node/package.json|^(\s*"version":\s*")[^"]+(")'
  'node/src/core.ts|^(export const VERSION = '"'"')[^'"'"']+('"'"')'
  'mcp/package.json|^(\s*"version":\s*")[^"]+(")'
  'mcp/server.json|^(  "version": ")[^"]+(")'
  'mcp/server.json|^(\s{6,}"version": ")[^"]+(")'
  'mcp/src/server.ts|^(export const VERSION = '"'"')[^'"'"']+('"'"')'
  'n8n/package.json|^(\s*"version":\s*")[^"]+(")'
  'python/pyproject.toml|^(version = ")[^"]+(")'
  'python/zapz/_version.py|^(VERSION = ")[^"]+(")'
  'ruby/zapz.gemspec|^(\s*s\.version = ")[^"]+(")'
  'ruby/lib/zapz.rb|^(\s*VERSION = ")[^"]+(")'
  'php/src/HttpClient.php|^(\s*public const VERSION = '"'"')[^'"'"']+('"'"')'
  'go/client.go|^(\s*Version = ")[^"]+(")'
  'java/pom.xml|^(  <version>)[^<]+(</version>)'
  'java/src/main/java/com/zapz/ZapZ.java|^(\s*public static final String VERSION = ")[^"]+(")'
  'csharp/src/ZapZ/ZapZ.csproj|^(\s*<Version>)[^<]+(</Version>)'
  'csharp/src/ZapZ/ZapZClient.cs|^(\s*public const string Version = ")[^"]+(")'
  'postman/version.toml|^(version = ")[^"]+(")'
)

# SDKs, one per release workflow (.github/workflows/release-*.yml). Each SDK lives in the folder
# of the same name and is released with the tag <sdk>/vX.Y.Z.
RELEASE_PREFIXES=(node mcp n8n python ruby csharp php java go postman)

# Prints "<file> <version>" for each entry of the given SDKs (all SDKs when none is given),
# or "<file> MISSING" when the regex finds no line.
read_versions() {
  local entry file regex
  for entry in "${VERSION_FILES[@]}"; do
    file="${entry%%|*}"
    regex="${entry#*|}"
    if [ "$#" -gt 0 ] && ! [[ " $* " == *" ${file%%/*} "* ]]; then continue; fi
    REGEX="$regex" perl -ne '
      BEGIN { $r = $ENV{REGEX}; $r =~ s/\[\^(.)\]\+/([^$1]+)/; }
      if (!$found && /$r/m) { print "$2\n"; $found = 1 }
    ' "$file" | { read -r v && echo "$file $v" || echo "$file MISSING"; }
  done
}
