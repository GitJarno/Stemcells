/**
 * Whether a server started in a folder (web mode, `pnpm dev`) launches or finds an empty
 * starter thread there and sends the page to it. Upstream does; Stemcells keeps the folder as
 * a project and opens on Aski and a new Cell. The starter thread looked like a Cell, but its
 * composer reads no words, so a message naming places went into the folder as written.
 */
export const launchesStarterThread: boolean = false;
