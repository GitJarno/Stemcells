#!/bin/bash
# down.sh: stops the lab server and every process under it, by the PID up.sh recorded.
#   down.sh          stop
#   down.sh --wipe   stop, then remove the lab folder (the pictures in $OUT stay)
. "$(dirname "$0")/env.sh"

tree() { # the pid and everything under it, children first
  local child
  for child in $(pgrep -P "$1" 2>/dev/null); do tree "$child"; done
  echo "$1"
}
if [ -f "$LAB/out/server.pid" ]; then
  root="$(cat "$LAB/out/server.pid")"
  if kill -0 "$root" 2>/dev/null; then
    pids="$(tree "$root")"
    for pid in $pids; do kill -TERM "$pid" 2>/dev/null; done
    for _ in $(seq 1 40); do
      alive=""
      for pid in $pids; do kill -0 "$pid" 2>/dev/null && alive="$alive $pid"; done
      [ -z "$alive" ] && break
      sleep 0.25
    done
    for pid in $alive; do kill -KILL "$pid" 2>/dev/null; done
  fi
  rm -f "$LAB/out/server.pid"
fi
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "port $PORT is still taken by something this script did not start" >&2; exit 1
fi
echo "port $PORT is free"
[ "${1:-}" = "--wipe" ] && rm -rf "$LAB" && echo "lab removed"
exit 0
