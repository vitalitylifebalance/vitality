#!/usr/bin/env bash
# Deploy vitality-v7 to Cloudflare Pages (direct upload) ONLY if the pre-deploy check passes.
# Usage: tools/deploy.sh   (from anywhere; cd's into the repo)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
"$ROOT/tools/predeploy-check.sh" "$ROOT"
npx wrangler pages deploy . --project-name vitality-v7 --commit-dirty=true
