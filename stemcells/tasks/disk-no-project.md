# Disk: the cleanup Cell starts with no project, and reads its own machine

"Free space" opened its Cell inside a project on that machine, and only a
Cell on this machine started from the walk: the client carried the
measurement, and a client reaches only its own machine's routes. A Cell
on another machine, or one started from the phone, walked the disk again
with `du`, the slow part.

## Plan

- [x] Web and phone open the Cell without a project, in upstream's folder
      for such threads (`projectEnvironment.openScratch`), on the machine it
      frees. No button where that machine offers no such folder.
- [x] `stemcells_disk_report`, an MCP tool of ours beside upstream's
      toolkits: the last walk when under 30 minutes old, else a walk now,
      waited for up to 45 s, then "still measuring" and the Cell calls again.
      A waiting Cell keeps the walk watched.
- [x] One ask on every surface (`CLEANUP_ASK`) that calls the tool first;
      the client-carried draft (`/api/stemcells/disk/cleanup-draft`) goes.
- [x] Contract test through upstream's MCP server; seams.md.

## Review

Kept the draft unsent: the person still picks the provider and model
before a Cell spends. No background walk ahead of the first call: the
walk runs on demand and is reused for 30 minutes, which covers the flow
(open, list, name IDs, delete) without disk work nobody asked for. The
contract test caught upstream's MCP server refusing a tool whose
parameters aren't an object schema (`Tool.EmptyParams`). Not run in a
real client.
