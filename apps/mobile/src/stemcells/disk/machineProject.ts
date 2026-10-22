/**
 * The first project on `environmentId`, where its cleanup Cell opens:
 * never one on another machine, since the Cell frees the disk it runs on.
 * Null when that machine has no project.
 */
export function projectOn<Project extends { readonly environmentId: string }>(
  environmentId: string,
  projects: ReadonlyArray<Project>,
): Project | null {
  return projects.find((project) => project.environmentId === environmentId) ?? null;
}
