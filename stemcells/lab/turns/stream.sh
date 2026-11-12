#!/bin/bash
# Lab rig: sends a turn to the chats on the given lines of threads.jsonl, or prints their states.
#   stream.sh <repo> send|state <line>...
LAB="${LAB:-/tmp/snappy-lab}"; REPO="$1"; DO="$2"; shift 2
cd "$REPO/apps/server" || exit 1
for n in "$@"; do
  id=$(sed -n "${n}p" "$LAB/out/threads.jsonl" | python3 -I -c "import sys,json; print(json.loads(sys.stdin.read())['threadId'])")
  if [ "$DO" = send ]; then node src/bin.ts thread send --base-dir "$LAB/home" "$id" "Go on, at length" >/dev/null 2>&1 &
  else node src/bin.ts thread show --base-dir "$LAB/home" "$id" 2>&1 | sed -n 2p | awk '{printf "%s ", $2}'; fi
done
wait; echo
