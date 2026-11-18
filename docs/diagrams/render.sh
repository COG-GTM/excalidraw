#!/usr/bin/env bash
# Renders the Graphviz sources in this folder to PNG and SVG.
# Requires Graphviz (`apt-get install graphviz` / `brew install graphviz`).
set -euo pipefail
cd "$(dirname "$0")"
for src in *.dot; do
  name="${src%.dot}"
  dot -Tsvg "$src" -o "$name.svg"
  dot -Tpng -Gdpi=110 "$src" -o "$name.png"
done
