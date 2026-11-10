#!/bin/bash
# Lab rig: prints the lab's Electron main PID, found in the launcher's own process tree.
L=$(cat /tmp/swipe-lab/out/lab.pid)
tree() { for p in $(pgrep -P "$1"); do echo "$p"; tree "$p"; done; }
for p in $(tree "$L"); do
  c=$(ps -o command= -p "$p")
  case "$c" in *"/Contents/MacOS/Electron --"*t3code-dev-root*) echo "$p"; exit 0;; esac
done
exit 1
