#!/bin/bash
# shoot.sh: runs shoot.mjs with the rig's paths (env.sh). Arguments pass through.
. "$(dirname "$0")/env.sh"
exec node "$RIG/shoot.mjs" "$@"
