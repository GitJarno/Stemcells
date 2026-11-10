#!/bin/bash
# Lab rig: queues `turns` Replay turns on each of the given chats (by their line in
# $LAB/out/threads.jsonl, from 0), so they stream side by side.
#   stream.sh <repo> <turns> <chat numbers...>
LAB="${LAB:-/tmp/swipe-lab}"
REPO="$1"; TURNS="$2"; shift 2
cd "$REPO/apps/server" || exit 1
for n in "$@"; do
  T=$(sed -n "$((n + 1))p" "$LAB/out/threads.jsonl" | python3 -I -c "import sys,json; print(json.loads(sys.stdin.read())['threadId'])")
  ( for i in $(seq 1 "$TURNS"); do node src/bin.ts thread send --base-dir "$LAB/home" "$T" "Again, please ($i)" >/dev/null 2>&1; done ) &
done
wait
