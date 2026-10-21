/**
 * Whether a server started in a folder (web mode, `pnpm dev`) launches an
 * empty starter thread there, or finds one already in it, and sends the page
 * to it. Upstream does. Stemcells keeps the folder as a project and opens on
 * Aski and a new Cell: the starter thread looked like a new Cell, but its
 * composer, a thread's, reads no words, so a message naming places went into
 * the folder as written.
 */
export const launchesStarterThread: boolean = false;
