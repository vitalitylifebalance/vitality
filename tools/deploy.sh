#!/usr/bin/env bash
# Deploy vitality-v7 to Cloudflare Pages (direct upload) ONLY if the pre-deploy check passes.
# wrangler ignores .gitignore, so the site is staged with rsync --exclude-from=.deployignore
# (drafts/, .pipeline_tmp/, docs/, tools/, ...) and the staged copy is what gets uploaded.
# Usage: tools/deploy.sh   (from anywhere; cd's into the repo)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
"$ROOT/tools/predeploy-check.sh" "$ROOT"

STAGE="$(mktemp -d "${TMPDIR:-/tmp}/vitality-v7-deploy.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT
rsync -a --exclude-from="$ROOT/.deployignore" "$ROOT/" "$STAGE/"
echo "deploy: staged $(find "$STAGE" -type f | wc -l | tr -d ' ') files in $STAGE (excluded via .deployignore)"
npx wrangler pages deploy "$STAGE" --project-name vitality-v7 --commit-dirty=true
