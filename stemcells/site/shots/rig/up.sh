#!/bin/bash
# up.sh: a private lab for the site's screenshots. A lab home with a fake for every provider and
# the scripted Replay agent, two neutral projects (Website, Docs), and the server on the built
# web app. Reads nothing of the person's: scratch HOME, no seeding, its own port.
#   up.sh            start (builds the web app first if apps/web/dist is missing)
. "$(dirname "$0")/env.sh"

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "port $PORT is taken; run down.sh or set PORT" >&2; exit 1
fi
mkdir -p "$LAB/home/bin" "$LAB/home/userdata" "$LAB/home/dev" "$LAB/out" "$LAB/go" "$LAB/userhome"

# Fakes: every provider's CLI is this, and Replay runs the scripted agent. Both carry the lab's mark.
printf '#!/bin/sh\n# stemcells-lab-fake\nexit 1\n' > "$LAB/home/bin/fake"
NODE_BIN="$(command -v node)"
printf '#!/bin/sh\n# stemcells-lab-fake: the site rig'"'"'s scripted agent, no model and no CLI\nSC_SITE_LAB="%s" exec "%s" "%s/agent.mjs"\n' \
  "$LAB" "$NODE_BIN" "$RIG" > "$LAB/home/bin/replay"
chmod +x "$LAB/home/bin/fake" "$LAB/home/bin/replay"
python3 -I - "$LAB" <<'PY'
import json, sys
lab = sys.argv[1]
fake = f"{lab}/home/bin/fake"
inst = {d: {"driver": d, "enabled": False, "config": {"binaryPath": fake}} for d in
        ["codex", "claudeAgent", "cursor", "grok", "opencode", "antigravity", "pi", "muse", "fx", "kiro"]}
inst["devReplay"] = {"displayName": "Replay", "driver": "acpRegistry",
                     "config": {"source": "local", "commandPath": f"{lab}/home/bin/replay", "commandArgs": []}}
for d in ("userdata", "dev"):
    json.dump({"providerInstances": inst}, open(f"{lab}/home/{d}/settings.json", "w"), indent=1)
PY
node "$REPO/stemcells/lab/fakes-only.cjs" "$LAB/home" || { echo "the lab home names something that is not a fake" >&2; exit 1; }

# Two projects, each a small git repository of its own.
printf '[user]\n\tname = lab\n\temail = lab@example.com\n[init]\n\tdefaultBranch = main\n' > "$LAB/userhome/.gitconfig"
for name in Website Docs; do
  dir="$LAB/$name"
  [ -d "$dir/.git" ] && continue
  mkdir -p "$dir/src" "$dir/docs"
  printf '# %s\n' "$name" > "$dir/README.md"
  printf ':root {\n  --bg: #ffffff;\n  --ink: #16181d;\n  --line: #e4e6ea;\n}\n' > "$dir/src/theme.css"
  (cd "$dir" && lab_env git init -q && lab_env git add . && lab_env git commit -qm "Start")
done

[ -f "$REPO/apps/web/dist/index.html" ] || {
  echo "building the web app…" >&2
  (cd "$REPO/apps/web" && env -u ELECTRON_RUN_AS_NODE PATH="$PWD/node_modules/.bin:$PATH" pnpm exec vp build > "$LAB/out/build.log" 2>&1) || { echo "build failed: $LAB/out/build.log" >&2; exit 1; }
}

cd "$REPO" || exit 1
NODE_OPTIONS="--require \"$REPO/stemcells/lab/never-shown.cjs\" --import \"$RIG/preview-hook.mjs\"" \
  lab_env nohup node apps/server/src/bin.ts serve --base-dir "$LAB/home" --port "$PORT" --host 127.0.0.1 --no-browser "$LAB/Website" \
  > "$LAB/out/server.log" 2>&1 &
echo $! > "$LAB/out/server.pid"
for _ in $(seq 1 120); do
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1 && break
  kill -0 "$(cat "$LAB/out/server.pid")" 2>/dev/null || { echo "the server stopped: $LAB/out/server.log" >&2; exit 1; }
  sleep 0.5
done
for name in Website Docs; do
  t3 project add --base-dir "$LAB/home" "$LAB/$name" 2>&1 | grep -q "Added project\|already" || echo "could not add $name" >&2
done
echo "server $(cat "$LAB/out/server.pid") on http://127.0.0.1:$PORT"
