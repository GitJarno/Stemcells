/**
 * The Disk project, where every cleanup Cell on a machine opens, wearing a hard drive. Its folder
 * among the machine's new projects makes it the one: renamed, it still is; deleted, the next Free
 * space makes it again there. A plain folder, not a checkout, so a Cell in it makes no worktree.
 */
export const DISK_PROJECT = {
  title: "Disk",
  folder: "disk",
  icon: "assets/icon.svg",
} as const;

/**
 * A hard drive on a graphite tile: Stemcells' ink on black, with a green activity light. Fixed
 * colours, as a project icon is drawn as an image, apart from the app's theme; the tile's
 * corners are the quarter round upstream clips a project's icon to.
 */
export const DISK_PROJECT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2E2E30"/>
      <stop offset="1" stop-color="#111112"/>
    </linearGradient>
    <linearGradient id="lid" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F8F5EF"/>
      <stop offset="1" stop-color="#E7E2D8"/>
    </linearGradient>
    <linearGradient id="face" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#DAD4C8"/>
      <stop offset="1" stop-color="#C6BFB1"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="16" fill="url(#tile)"/>
  <rect x=".5" y=".5" width="63" height="63" rx="15.5" fill="none" stroke="#FFFFFF" stroke-opacity=".14"/>
  <rect x="9" y="20" width="46" height="28" rx="7.5" fill="#000000" fill-opacity=".45"/>
  <path d="M16.5 18h31a7.5 7.5 0 0 1 7.5 7.5V32H9v-6.5A7.5 7.5 0 0 1 16.5 18z" fill="url(#lid)"/>
  <path d="M9 32h46v6.5a7.5 7.5 0 0 1-7.5 7.5h-31A7.5 7.5 0 0 1 9 38.5z" fill="url(#face)"/>
  <rect x="9" y="31" width="46" height="1.5" fill="#978F7F"/>
  <rect x="9" y="32.5" width="46" height=".75" fill="#EFEAE0"/>
  <rect x="15.5" y="37.75" width="9" height="2.5" rx="1.25" fill="#9C9484"/>
  <circle cx="46.5" cy="39" r="4.75" fill="#2AD394" fill-opacity=".3"/>
  <circle cx="46.5" cy="39" r="2.75" fill="#2AD394"/>
  <circle cx="45.6" cy="38.1" r=".9" fill="#FFFFFF" fill-opacity=".65"/>
</svg>
`;

/** The Disk project's folder in a machine's folder for new projects (`newProjectsRoot`). */
export function diskProjectFolder(newProjectsRoot: string): string {
  const separator = /^(?:[A-Za-z]:|\\\\)/.test(newProjectsRoot) ? "\\" : "/";
  return `${newProjectsRoot.replace(/[\\/]+$/, "")}${separator}${DISK_PROJECT.folder}`;
}

/** What opening the Disk project takes from one machine: upstream's project commands there. */
export interface DiskProjectMachine<Id, Project> {
  /** The machine's project in `folder`, whatever it is called now. */
  readonly projectIn: (folder: string) => Project | null;
  /** A new project in `folder`, making the folder if it's missing; null when it couldn't. */
  readonly create: (input: {
    readonly title: string;
    readonly workspaceRoot: string;
  }) => Promise<Id | null>;
  readonly writeFile: (input: {
    readonly cwd: string;
    readonly relativePath: string;
    readonly contents: string;
  }) => Promise<boolean>;
  readonly setIcon: (projectId: Id, faviconPath: string) => Promise<unknown>;
  /** The project once this client has it, or null when it doesn't come. */
  readonly arrived: (projectId: Id) => Promise<Project | null>;
}

/** The machine's Disk project, made with its icon when there is none; null when it couldn't be. */
export async function openDiskProject<Id, Project>(
  newProjectsRoot: string,
  machine: DiskProjectMachine<Id, Project>,
): Promise<Project | null> {
  const folder = diskProjectFolder(newProjectsRoot);
  const found = machine.projectIn(folder);
  if (found !== null) return found;
  const projectId = await machine.create({ title: DISK_PROJECT.title, workspaceRoot: folder });
  if (projectId === null) return null;
  // A file goes only into a project's folder, so the icon comes second. Naming it on the project
  // passes over the miss the server cached while the folder was empty.
  const drawn = await machine.writeFile({
    cwd: folder,
    relativePath: DISK_PROJECT.icon,
    contents: DISK_PROJECT_ICON,
  });
  if (drawn) await machine.setIcon(projectId, DISK_PROJECT.icon);
  return machine.arrived(projectId);
}
