#!/bin/bash
# Lab rig: starts the desktop lab app on the lab home, with the rig's addon in its main
# process; prints the launcher's PID. Stop it with `kill -TERM` on that PID.
#   lab-start.sh <repo>
RIG="$(cd "$(dirname "$0")" && pwd)"
LAB="${LAB:-/tmp/swipe-lab}"
mkdir -p "$LAB/out"
cd "$1" || exit 1
env -u ELECTRON_RUN_AS_NODE NODE_OPTIONS="--require $RIG/inject.cjs" \
  T3CODE_DESKTOP_REMOTE_DEBUGGING_PORT=9377 STEMCELLS_LAB_PROFILE="$LAB/profile" \
  ELECTRON_ENABLE_LOGGING=1 nohup stemcells/lab/electron dev --home-dir "$LAB/home" \
  > "$LAB/out/lab.log" 2>&1 &
echo $! > "$LAB/out/lab.pid"
cat "$LAB/out/lab.pid"
