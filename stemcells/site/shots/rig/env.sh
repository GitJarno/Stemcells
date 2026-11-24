#!/bin/bash
# Shared by up/seed/shoot/down: where the lab lives. REPO is the checkout you run from; override
# REPO, LAB, PORT or OUT from the shell.
RIG="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="${REPO:-$(git rev-parse --show-toplevel 2>/dev/null)}"
[ -n "$REPO" ] || { echo "run this from inside the Stemcells checkout, or set REPO to it" >&2; exit 1; }
LAB="${LAB:-/tmp/stemcells-shots/lab}"
PORT="${PORT:-4517}"
OUT="${OUT:-/tmp/stemcells-shots/app}"
export RIG REPO LAB PORT OUT

# The server and its CLI run on a scratch HOME, so nothing of the person's can be read or shown.
lab_env() {
  env -u ELECTRON_RUN_AS_NODE -u T3CODE_HOME -u T3CODE_RELAY_URL \
    HOME="$LAB/userhome" \
    GIT_AUTHOR_NAME=lab GIT_AUTHOR_EMAIL=lab@example.com \
    GIT_COMMITTER_NAME=lab GIT_COMMITTER_EMAIL=lab@example.com \
    GIT_CONFIG_GLOBAL="$LAB/userhome/.gitconfig" GIT_CONFIG_NOSYSTEM=1 \
    T3CODE_ENVIRONMENT_LABEL="Mac" \
    STEMCELLS_LAB_HOME="$LAB/home" STEMCELLS_LAB_PROFILE="$LAB/profile" \
    SC_SITE_LAB="$LAB" SC_SITE_RIG="$RIG" \
    "$@"
}

# The CLI against the running lab server: t3 thread start …, t3 pair …
t3() {
  (cd "$REPO/apps/server" && lab_env node src/bin.ts "$@")
}
