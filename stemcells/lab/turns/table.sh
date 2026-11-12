#!/bin/bash
# Lab rig: the turn table for one phase.  table.sh <repo> <phase> [n]
REPO="$1"; PHASE="$2"; N="${3:-10}"; LAB="${LAB:-/tmp/snappy-lab}"; RIG="$(cd "$(dirname "$0")" && pwd)"
for c in "near 1" "near 4" "far 1" "far 4"; do
  set -- $c
  node "$RIG/measure.mjs" --repo "$REPO" --case "$1" --n "$N" --throttle "$2" --out "$LAB/out/$PHASE-$1-t$2.json" 2> "$LAB/out/$PHASE-$1-t$2.log" | tail -1
done
