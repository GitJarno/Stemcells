#!/bin/bash
# Lab rig: a lab home with a fake for every provider and Replay, and the server on it serving the built web app.
#   lab-up.sh <repo> <port>
REPO="$1"; PORT="$2"; LAB="${LAB:-/tmp/snappy-lab}"
mkdir -p "$LAB/home/bin" "$LAB/home/userdata" "$LAB/home/dev" "$LAB/out" "$LAB/project"
printf '#!/bin/sh\n# stemcells-lab-fake\nexit 1\n' > "$LAB/home/bin/fake"; chmod +x "$LAB/home/bin/fake"
NODE_BIN="$(command -v node)"
python3 -I - "$LAB" "$REPO" "$NODE_BIN" <<'PY'
import json, sys
lab, repo, node = sys.argv[1:4]
fake = f"{lab}/home/bin/fake"
inst = {d: {"driver": d, "config": {"binaryPath": fake}} for d in ["codex","claudeAgent","cursor","grok","opencode","antigravity","pi","muse","fx","kiro"]}
inst["devReplay"] = {"displayName": "Replay (dev)", "driver": "acpRegistry", "config": {"source": "local", "commandPath": node, "commandArgs": [f"{repo}/apps/server/scripts/dev-replay-agent.ts"]}}
for d in ("userdata", "dev"):
    json.dump({"providerInstances": inst}, open(f"{lab}/home/{d}/settings.json", "w"), indent=1)
PY
[ -d "$LAB/project/.git" ] || (cd "$LAB/project" && git init -q && echo "# Website" > README.md && git add . && git -c user.name=lab -c user.email=lab@example.com commit -qm init)
cd "$REPO" || exit 1
env -u ELECTRON_RUN_AS_NODE STEMCELLS_LAB_HOME="$LAB/home" STEMCELLS_LAB_PROFILE="$LAB/profile" \
  NODE_OPTIONS="--require \"$REPO/stemcells/lab/never-shown.cjs\"" \
  nohup node apps/server/src/bin.ts serve --base-dir "$LAB/home" --port "$PORT" --host 127.0.0.1 --no-browser "$LAB/project" \
  > "$LAB/out/server.log" 2>&1 &
echo $! > "$LAB/out/server.pid"; cat "$LAB/out/server.pid"
