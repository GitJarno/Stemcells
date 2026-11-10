#!/bin/bash
# Lab rig: keeps one chat streaming while `flag` exists: two Replay turns whenever it has none,
# so one is always queued behind the one running. Chats go by their line in $LAB/out/threads.jsonl, from 0.
#   feed.sh <repo> <flag> <chat number>
LAB="${LAB:-/tmp/swipe-lab}"
REPO="$1"; FLAG="$2"; N="$3"
cd "$REPO/apps/server" || exit 1
T=$(sed -n "$((N + 1))p" "$LAB/out/threads.jsonl" | python3 -I -c "import sys,json; print(json.loads(sys.stdin.read())['threadId'])")
status() { node src/bin.ts thread show --base-dir "$LAB/home" --json --messages 0 "$T" 2>/dev/null | python3 -I -c "import sys,json; print(json.loads(sys.stdin.read())['thread']['status'])" 2>/dev/null; }
turn=0
while [ -e "$FLAG" ]; do
  if [ "$(status)" != running ]; then
    for _ in 1 2; do
      turn=$((turn + 1))
      node src/bin.ts thread send --base-dir "$LAB/home" "$T" "Again, please ($turn)" >/dev/null 2>&1
    done
  fi
  sleep 1
done
# The turns under way end by themselves; the next case starts on a quiet page.
sleep 2
until [ "$(status)" != running ]; do sleep 2; done
