#!/bin/bash
# Lab rig: starts the desktop lab app on the lab home; prints the launcher's PID.
cd "$1" || exit 1
env -u ELECTRON_RUN_AS_NODE NODE_OPTIONS="--require /tmp/swipe-lab/rig/inject.cjs" T3CODE_DESKTOP_REMOTE_DEBUGGING_PORT=9377 STEMCELLS_LAB_PROFILE=/tmp/swipe-lab/profile ELECTRON_ENABLE_LOGGING=1 nohup stemcells/lab/electron dev --home-dir /tmp/swipe-lab/home > /tmp/swipe-lab/out/lab.log 2>&1 &
echo $! > /tmp/swipe-lab/out/lab.pid
cat /tmp/swipe-lab/out/lab.pid
