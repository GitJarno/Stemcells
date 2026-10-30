/**
 * The column's project filter (stemcells/tasks/left-column-v3.md, decision 9): one of upstream's
 * project groups, which may hold a project on several machines. Asks never hide: Input
 * counts the ones it leaves out, and says where they are.
 */

/** A project as the filter picks it: upstream's group, by key, and its members. */
export interface FilterProject {
  readonly key: string;
  readonly name: string;
  /** Every project of the group, as `environmentId:projectId`. */
  readonly memberKeys: ReadonlyArray<string>;
}

/** Whether a Cell in `projectId` on `environmentId` shows under `project`: every Cell with none. */
export function shows(
  project: FilterProject | null,
  environmentId: string,
  projectId: string,
): boolean {
  return project === null || project.memberKeys.includes(`${environmentId}:${projectId}`);
}

export interface Elsewhere {
  /** The project's name; null for asks in a project upstream's list doesn't hold. */
  readonly name: string | null;
  readonly count: number;
}

/** Where the asks `project` leaves out are: by project in the list's order, then the rest. */
export function elsewhere(
  project: FilterProject | null,
  projects: ReadonlyArray<FilterProject>,
  environmentId: string,
  asks: ReadonlyArray<{ readonly projectId: string }>,
): ReadonlyArray<Elsewhere> {
  if (project === null) return [];
  const left = asks.filter((ask) => !shows(project, environmentId, ask.projectId));
  const named = projects.flatMap((each) => {
    const count = left.filter((ask) => shows(each, environmentId, ask.projectId)).length;
    return count > 0 ? [{ name: each.name, count }] : [];
  });
  const unplaced = left.length - named.reduce((sum, each) => sum + each.count, 0);
  return unplaced > 0 ? [...named, { name: null, count: unplaced }] : named;
}

/** "Also 2 in Website and 1 elsewhere"; null when nothing is left out. */
export function elsewhereWords(places: ReadonlyArray<Elsewhere>): string | null {
  const parts = places.map((place) =>
    place.name === null ? `${place.count} elsewhere` : `${place.count} in ${place.name}`,
  );
  if (parts.length === 0) return null;
  const last = parts.at(-1);
  return parts.length === 1 ? `Also ${last}` : `Also ${parts.slice(0, -1).join(", ")} and ${last}`;
}
