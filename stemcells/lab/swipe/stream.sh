#!/bin/bash
# Lab rig: queues `turns` Replay turns on each of the given threads (by number, 0-19), so they
# stream side by side. stream.sh <repo> <turns> <thread numbers...>
REPO="$1"; TURNS="$2"; shift 2
cd "$REPO/apps/server" || exit 1
FIRST="mcp:c4f31525-ce96-4cef-9156-aec69333f49f"
for n in "$@"; do
  if [ "$n" = 0 ]; then T="$FIRST"; else T=$(sed -n "${n}p" /tmp/swipe-lab/out/threads.jsonl | python3 -c "import sys,json; print(json.loads(sys.stdin.read())['threadId'])"); fi
  ( for i in $(seq 1 "$TURNS"); do node src/bin.ts thread send --base-dir /tmp/swipe-lab/home "$T" "Again, please ($i)" >/dev/null 2>&1; done ) &
done
wait
