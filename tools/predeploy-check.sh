#!/usr/bin/env bash
# Pre-deploy guard for vitality-v7 (Cloudflare Pages).
# Fails (exit 1) if:
#   1. any HTML loads Google Fonts (fonts.googleapis.com / fonts.gstatic.com)
#      -> all fonts are self-hosted under /assets/fonts/ (fix/seguridad-legal, 26-oct-2026)
#   2. a language home (index.html, en/ fr/ de/ pt/) is missing the preload of
#      the five hero woff2 files (perf commit fabfa52, 29-oct-2026)
# Usage: tools/predeploy-check.sh [repo-root]   (default: repo that holds this script)
set -u
ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ROOT" || exit 2

HOMES=(index.html en/index.html fr/index.html de/index.html pt/index.html)
# The five fonts the homes render above the fold (see en/index.html <head>).
HOME_PRELOADS=(
  UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7W0Q5nw.woff2
  UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1pL7W0Q5n-wU.woff2
  V8mDoQDjQSkFtoMM3T6r8E7mPbF4C_k3HqU.woff2
  co3bmX5slCNuHLi8bLeY9MK7whWMhyjYqXtKky2F7g.woff2
  co3ZmX5slCNuHLi8bLeY9MK7whWMhyjYrEtImSqn7B6D.woff2
)

errors=0

# 1. No Google Fonts anywhere in the published HTML.
offenders=$(grep -rl "fonts\.googleapis\.com\|fonts\.gstatic\.com" \
  --include="*.html" --exclude-dir=node_modules --exclude-dir=.git . || true)
if [ -n "$offenders" ]; then
  echo "FAIL: these HTML files still load Google Fonts (use /assets/fonts/fonts-*.css):"
  echo "$offenders" | sed 's/^/  /'
  errors=$((errors + 1))
fi

# 2. Every home preloads the five woff2 and references a self-hosted CSS.
for home in "${HOMES[@]}"; do
  if [ ! -f "$home" ]; then
    echo "FAIL: home not found: $home"
    errors=$((errors + 1)); continue
  fi
  for font in "${HOME_PRELOADS[@]}"; do
    if ! grep -q "rel=\"preload\" as=\"font\"[^>]*/assets/fonts/$font" "$home"; then
      echo "FAIL: $home is missing <link rel=\"preload\" as=\"font\"> for $font"
      errors=$((errors + 1))
    fi
  done
  if ! grep -q "/assets/fonts/fonts-[0-9a-f]*\.css" "$home"; then
    echo "FAIL: $home does not link a self-hosted /assets/fonts/fonts-*.css"
    errors=$((errors + 1))
  fi
done

html_count=$(find . -name "*.html" -not -path "./node_modules/*" -not -path "./.git/*" | wc -l | tr -d ' ')
if [ "$errors" -gt 0 ]; then
  echo "predeploy-check: $errors problem(s) in $html_count HTML files. Deploy blocked."
  exit 1
fi
echo "predeploy-check: OK ($html_count HTML files, no Google Fonts, 5 preloads in ${#HOMES[@]} homes)."
