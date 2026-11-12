#!/bin/bash
# Lab rig: starts chats `from`..`to` on Replay and queues `turns` history turns on each.
#   chats.sh <repo> <from> <to> <turns>
LAB="${LAB:-/tmp/snappy-lab}"; REPO="$1"; FROM="$2"; TO="$3"; TURNS="$4"
cd "$REPO/apps/server" || exit 1
one() {
  local n="$1" id
  id=$(node src/bin.ts thread start --base-dir "$LAB/home" --provider devReplay --model showcase --json "$LAB/project" "Tour $n" 2>/dev/null | python3 -I -c "import sys,json; print(json.loads(sys.stdin.read().strip().splitlines()[-1])['threadId'])")
  [ -n "$id" ] || { echo "chat $n failed"; return; }
  echo "{\"threadId\":\"$id\"}" >> "$LAB/out/threads.jsonl"
  for i in $(seq 2 "$TURNS"); do node src/bin.ts thread send --base-dir "$LAB/home" "$id" "Again, please ($i)" >/dev/null 2>&1; done
}
for n in $(seq "$FROM" "$TO"); do
  one "$n" &
  if [ $(( (n - FROM + 1) % 4 )) = 0 ]; then wait; fi
done
wait
