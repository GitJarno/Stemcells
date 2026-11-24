#!/bin/bash
# seed.sh: runs seed.mjs with the rig's paths (env.sh). Arguments pass through.
. "$(dirname "$0")/env.sh"
exec node "$RIG/seed.mjs" "$@"
