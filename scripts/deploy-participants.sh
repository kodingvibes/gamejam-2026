#!/usr/bin/env bash
# Build every participant and stage the result for GitHub Pages.
# - Participants with a package.json + build script: run `npm ci && npm run build`
#   and stage `dist/`. Vite's config (or the --base flag below) must produce
#   relative asset URLs so the bundle works from /participantes/<name>/.
# - Participants without a build (plain HTML/JS): stage the folder as-is and
#   rewrite any leading-slash asset references in index.html to be relative.
set -euo pipefail

STAGING=".gh-pages-staging"
rm -rf "$STAGING"
mkdir -p "$STAGING"

for dir in participantes/*/; do
  [ -d "$dir" ] || continue
  name="$(basename "$dir")"
  out="$STAGING/$name"
  mkdir -p "$out"

  if [ -f "$dir/package.json" ] && jq -e '.scripts.build' "$dir/package.json" >/dev/null 2>&1; then
    echo "==> Build: $name"
    pushd "$dir" >/dev/null
    npm ci --no-audit --no-fund --silent
    # --base=./ keeps asset URLs relative so the bundle works from the
    # /participantes/<name>/ subpath.
    npm run build -- --base=./ --outDir=dist 2>/dev/null || npm run build
    popd >/dev/null
    if [ -d "$dir/dist" ]; then
      cp -r "$dir/dist/." "$out/"
    else
      echo "    WARN: no dist/ produced for $name"
    fi
  elif [ -f "$dir/index.html" ]; then
    echo "==> Static: $name"
    rsync -a --exclude='node_modules' --exclude='dist' --exclude='.git' "$dir/" "$out/"
    sed -i -E 's#(href|src)="/#\1="./#g' "$out/index.html"
  else
    echo "==> Skip: $name (no index.html)"
  fi
done

echo "Staged:"
ls -la "$STAGING"