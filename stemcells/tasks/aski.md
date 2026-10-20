# Aski's tab and Cells on the tabs (first slice, item 2)

## Plan

- [x] Persona (`aski/persona.md`) and its launch arguments per provider (`aski/setup.ts`).
- [x] Adapter (`upstream/aski.ts`): Aski's provider instance through upstream's
      settings mutation, Aski's chat created and pinned through upstream's
      commands, remembered under `stemcells.aski`.
- [x] Aski's tab: fixed first, never closes, moves or splits, shows Aski over
      its chat; a chat routed while it is focused opens a tab of its own.
- [x] Cells: a `CellFigure` on each tab chip and split pane header, its mood
      from upstream's status pill (`upstream/status.ts`), "?" while it waits
      on the person.
- [x] Contract tests: status labels, launch arguments read back, tool names
      (web and server).
- [x] `stemcells.css` imported once from the workspace root.
- [x] Real-app proof: Aski's tab, a strip of Cells in different moods, a split.

## Review

- No seam. The persona travels inline in the instance's launch arguments
  (`--append-system-prompt "…"` for Claude, `-c developer_instructions="…"`
  for Codex), written with upstream's provider-instance mutation, so no file
  and no server endpoint were needed. The Claude adapter reads
  `--append-system-prompt-file` relative to the thread's cwd without
  expanding `~`, so a file would have needed the server's home path anyway.
- Every thread already gets the orchestration MCP capability
  (`ProviderSessionManager`); `t3_thread_launch` lives in the project
  toolkit, the rest in the orchestrator toolkit.
- Proof shots: the Cells' moods were reached by rewriting what the dev server
  reported of five test chats' runs (WebSocket and `/api/orchestration/shell`),
  never by calling a provider.
- One Aski chat per server: a browser that hasn't met it (or remembers one
  since deleted) adopts the top-level chat on the "aski" instance, the
  pinned one first, else the first made, once the server's chats have
  loaded, and pins it again if someone unpinned it; it makes one only when
  none exists. `stemcells.aski` is just the fast path. Checked in the dev
  app: a fresh browser opened the existing chat and made none.
- Cells Aski starts never run on the "aski" instance: both
  `t3_thread_launch` and `delegate_task` inherit the caller's instance when
  told nothing, so the persona has every launch name the project's default
  model (`t3_project_read`), whole as `modelSelection`, or as
  `target.providerInstanceId` and `target.model`; without one, the driver's
  own instance with Aski's model. A server contract test resolves every
  `tool(argument).result` the persona spells out against the tools' schemas.
- Aski finds Cells project by project: `t3_thread_list` without a projectId
  lists only its own chat's project, so the persona lists projects with
  `t3_project_list` and then each named project's (or every project's)
  Cells, following `nextCursor`. Settled Cells come along when `settled` is
  left out; archived ones are out of reach of every tool (the list and the
  search read active chats only), and the persona says so to the person.
- Open: activity from the newest running tool item needs the thread's detail
  (one subscription per tab), so only "waiting" is shown, from the status;
  the Codex persona path is unverified end to end (T3's per-turn
  collaboration-mode instructions may override it); upstream's first-message
  title generation renames Aski's thread in the sidebar (the tab still says
  Aski); Aski's band stands on Stemcells' dark ground on upstream's light
  theme too, as the figure's renderer reads only rgb() colours.
