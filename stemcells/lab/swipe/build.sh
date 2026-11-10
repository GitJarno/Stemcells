#!/bin/bash
# Lab rig: builds the rig's two native pieces into $LAB_BIN (default /tmp/swipe-lab/bin): the
# addon that posts scroll events inside the lab app, and the lister of its windows.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
BIN="${LAB_BIN:-/tmp/swipe-lab/bin}"
mkdir -p "$BIN"
xcrun clang -fobjc-arc -O2 -Wall -Wextra -dynamiclib -undefined dynamic_lookup \
  -framework AppKit -o "$BIN/inject.node" "$HERE/inject.m"
xcrun swiftc -O -o "$BIN/swipepost" "$HERE/swipepost.swift"
echo "built into $BIN"
