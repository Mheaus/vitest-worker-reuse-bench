#!/usr/bin/env bash
# Runs bench.mjs for each pool, first on the published Vitest, then with keep-runner-patch.mjs.
set -euo pipefail
configs=("threads" "threads no-isolate" "forks" "forks no-isolate" "vmThreads" "vmForks")
echo "node $(node -v), vitest $(node -p "require('vitest/package.json').version")"
for mode in published patched; do
  if [ "$mode" = patched ]; then node keep-runner-patch.mjs apply >/dev/null; fi
  echo "## $mode"
  for c in "${configs[@]}"; do node bench.mjs $c | head -1; done
done
node keep-runner-patch.mjs restore >/dev/null
