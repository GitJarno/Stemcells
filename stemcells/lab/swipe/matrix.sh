#!/bin/bash
# Lab rig: the whole matrix for one phase (before|after), quiet then under load.
#   matrix.sh <repo> <phase> [quiet|load|all]
REPO="$1"; PHASE="$2"; PART="${3:-all}"
OUT=/tmp/swipe-lab/out/$PHASE; mkdir -p "$OUT"
cd /tmp/swipe-lab/rig || exit 1
N=${N:-30}
LATCH=${LATCH:-8}
run() { # name case extra...
  local name="$1" kase="$2"; shift 2
  echo "== $name $(date +%H:%M:%S) load $(uptime | sed 's/.*averages: //')"
  node run.mjs --case "$kase" --n "$N" --out "$OUT/$name.json" "$@" 2>&1 | tail -2
}
traced() { # name extra...
  local name="$1"; shift
  echo "== $name (traced) $(date +%H:%M:%S)"
  rm -f "$OUT/$name.trace".*
  node run.mjs --case single --n 12 --trace "$OUT/$name.trace" --out "$OUT/$name.json" "$@" 2>&1 | tail -2
  python3 -I analyze.py "$OUT/$name.json" "$OUT/$name.trace" --latch "$LATCH" --out "$OUT/$name.frames.json"
  rm -f "$OUT/$name.trace".*
}
if [ "$PART" = quiet ] || [ "$PART" = all ]; then
  run q-single single
  run q-onechat onechat
  run q-onechat-nophases onechat --phases 0
  run q-quick2 quick2
  run q-short short
  run q-hard hard
  run q-slow slow
  traced q-frames
fi
if [ "$PART" = load ] || [ "$PART" = all ]; then
  touch "$OUT/feeding"
  ( while [ -e "$OUT/feeding" ]; do /tmp/swipe-lab/rig/stream.sh "$REPO" 5 0 1 2 3 4 5 9 10 11 12 13 14 >/dev/null 2>&1; sleep 30; done ) &
  FEEDER=$!
  sleep 15
  L="--throttle 2 --hold 120/500"
  run l-single single $L
  run l-onechat onechat $L
  run l-onechat-nophases onechat --phases 0 $L
  run l-quick2 quick2 $L
  run l-short short $L
  run l-hard hard $L
  run l-single-nophases single --phases 0 $L
  traced l-frames $L
  rm -f "$OUT/feeding"
  kill "$FEEDER" 2>/dev/null
fi
echo "== done $(date +%H:%M:%S)"
