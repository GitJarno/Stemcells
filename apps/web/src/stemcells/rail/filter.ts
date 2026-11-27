/**
 * The column's project filter (stemcells/tasks/left-column-v3.md, decision 9): one of upstream's
 * project groups, which may hold a project on several machines.
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
