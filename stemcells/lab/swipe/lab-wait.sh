#!/bin/bash
# Lab rig: waits until the lab app's page answers and its workspace is mounted.
RIG="$(cd "$(dirname "$0")" && pwd)"
for i in $(seq 1 60); do
  if curl -s http://127.0.0.1:9377/json 2>/dev/null | grep -q '"type": "page"'; then
    n=$(node "$RIG/cdp.mjs" 'document.querySelectorAll("[data-stemcells-page]").length' 2>/dev/null | tail -1)
    if [ "${n:-0}" -ge 2 ] 2>/dev/null; then echo "up: $n pages"; exit 0; fi
  fi
  sleep 3
done
echo "lab did not come up"; exit 1
