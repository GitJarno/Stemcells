/** Stemcells: the windows' IPC channels, shared by the main process and the preload. */
export const WINDOWS_CHANNEL = {
  /** Page → main, synchronous: who this window is, and the workspace it starts from. */
  boot: "stemcells:windows:boot",
  /** Page → main: the window's workspace, after each change it makes. */
  publish: "stemcells:windows:publish",
  /** Page → main, invoked: every window, for a move to be made from. */
  snapshot: "stemcells:windows:snapshot",
  /** Page → main, invoked: a move between windows, answered "done" or "stale". */
  commit: "stemcells:windows:commit",
  /** Main → page: a workspace a move gave this window. */
  adopt: "stemcells:windows:adopt",
  /** Page → main: the page took the workspace it was sent. */
  adopted: "stemcells:windows:adopted",
  /** Main → page: whether this window now leads. */
  lead: "stemcells:windows:lead",
  /** Main → the lead page: a window the person closed, with its workspace. */
  closed: "stemcells:windows:closed",
  /** Main → page: a window a move made that couldn't open, with its workspace, to take back. */
  returned: "stemcells:windows:returned",
} as const;

/** What a page learns at load: `null` workspace for a window the book has nothing for yet. */
export interface WindowBoot {
  readonly id: string;
  readonly lead: boolean;
  readonly workspace: unknown;
}
