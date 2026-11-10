#!/bin/bash
# Lab rig: the whole table for one phase, quiet then under load, the Mac's load average beside
# each run. `before` is the old pager (its letting go was by distance, and its strip latched
# 8 px in); anything else is the proxy.
#   matrix.sh <repo> <phase> [quiet|load|stream|all] [extra]
RIG="$(cd "$(dirname "$0")" && pwd)"
LAB="${LAB:-/tmp/swipe-lab}"
REPO="$1"; PHASE="$2"; PART="${3:-all}"; EXTRA="$4"
OUT="$LAB/out/$PHASE"; mkdir -p "$OUT"
N=${N:-30}
if [ "$PHASE" = before ]; then LATCH=${LATCH:-8}; RULE="--rule distance"; else LATCH=${LATCH:-0}; RULE=""; fi
run() { # name case extra...
  local name="$1" kase="$2"; shift 2
  echo "== $name $(date +%H:%M:%S) load $(uptime | sed 's/.*averages: //')"
  node "$RIG/run.mjs" --case "$kase" --n "$N" --out "$OUT/$name.json" $RULE "$@" > "$OUT/$name.log" 2>&1
  tail -2 "$OUT/$name.log"
}
traced() { # name extra...
  local name="$1"; shift
  echo "== $name (traced) $(date +%H:%M:%S) load $(uptime | sed 's/.*averages: //')"
  rm -f "$OUT/$name.trace".*
  node "$RIG/run.mjs" --case single --n 12 --trace "$OUT/$name.trace" --out "$OUT/$name.json" "$@" > "$OUT/$name.log" 2>&1
  tail -2 "$OUT/$name.log"
  python3 -I "$RIG/analyze.py" "$OUT/$name.json" "$OUT/$name.trace" --latch "$LATCH" --out "$OUT/$name.frames.json"
  rm -f "$OUT/$name.trace".*
}
mid() { # prefix extra...: the cases round the middle tabs
  local p="$1"; shift
  run "$p-single" single "$@"
  run "$p-quick2" quick2 "$@"
  traced "$p-frames" "$@"
}
rest() { # prefix extra...: the other gestures round the middle tabs
  local p="$1"; shift
  run "$p-short" short "$@"
  run "$p-hard" hard "$@"
  run "$p-slow" slow "$@"
  run "$p-drag" drag "$@"
  run "$p-single-nophases" single --phases 0 "$@"
  if [ "$EXTRA" = extra ]; then
    run "$p-nudge" nudge "$@"
    run "$p-vwobble" vwobble "$@"
    run "$p-inner" inner "$@"
    run "$p-elsewhere" elsewhere "$@"
    run "$p-rested" rested "$@"
  fi
}
ends() { # prefix extra...: onto the one-chat tab between tabs of several, and back off it
  local p="$1"; shift
  run "$p-onechat" onechat "$@"
  run "$p-onechat-nophases" onechat --phases 0 "$@"
  run "$p-manychat" manychat "$@"
}
fed() { # chat command...: runs the command with that chat streaming
  local chat="$1"; shift
  touch "$OUT/feeding"
  "$RIG/feed.sh" "$REPO" "$OUT/feeding" "$chat" &
  local feeder=$!
  sleep 6
  "$@"
  rm -f "$OUT/feeding"
  wait "$feeder"
}
if [ "$PART" = quiet ] || [ "$PART" = all ]; then
  ends q
  mid q
  rest q
fi
if [ "$PART" = load ] || [ "$PART" = all ]; then
  # The load: the page's CPU at a quarter speed and its main thread held 120 ms in every 500.
  ends l --throttle 4 --hold 120/500
  mid l --throttle 4 --hold 120/500
  if [ "$EXTRA" = extra ]; then rest l --throttle 4 --hold 120/500; fi
fi
if [ "$PART" = stream ] || [ "$PART" = all ]; then
  # A chat streaming on a page the strip holds. Few swipes: every turn it streams stays in the
  # lab's chats, and a page of hundreds runs out of memory.
  fed 2 run s-onechat onechat
  fed 12 traced s-frames
fi
echo "== done $(date +%H:%M:%S)"
