// The home's scope: the projects and machines the person ticked in the header (`scope.tsx`).
// Any number of each; none ticked is all, and so is every one ticked, so a project added later
// isn't left out. The phone keeps them (`usePicks.ts`).

export interface Picks {
  /** Project groups' keys (`buildHomeProjectScopes` across every machine). */
  readonly projects: ReadonlyArray<string>;
  /** Environment ids. */
  readonly machines: ReadonlyArray<string>;
}

export const NO_PICKS: Picks = { projects: [], machines: [] };

/** `key` ticked or unticked; ticking the last one left means all, and reads as none. */
export function toggled(
  picked: ReadonlyArray<string>,
  key: string,
  every: ReadonlyArray<string>,
): ReadonlyArray<string> {
  const next = picked.includes(key) ? picked.filter((one) => one !== key) : [...picked, key];
  return every.length > 0 && every.every((one) => next.includes(one)) ? [] : next;
}

/** The picks that still name something: a project or machine since gone narrows nothing. */
export function inEffect(picked: ReadonlyArray<string>, every: ReadonlyArray<string>) {
  return picked.filter((key) => every.includes(key));
}

/** A kept file read back; anything it can't read is no picks. */
export function picksFrom(text: string | null): Picks {
  if (text === null) return NO_PICKS;
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== "object" || value === null) return NO_PICKS;
    const strings = (list: unknown) =>
      Array.isArray(list) ? list.filter((one): one is string => typeof one === "string") : [];
    return {
      projects: strings((value as Record<string, unknown>).projects),
      machines: strings((value as Record<string, unknown>).machines),
    };
  } catch {
    return NO_PICKS;
  }
}

/**
 * The one machine and the one project the picks narrow the home to, as T3's list filter names
 * them, for a new Cell to start there; null for none or several. As the header lists them, a
 * project on none of the machines picked narrows nothing.
 */
export function oneOfEach(
  picks: Picks,
  projects: ReadonlyArray<{
    readonly key: string;
    readonly projectRefs: ReadonlyArray<{ readonly environmentId: string }>;
  }>,
): { readonly machine: string | null; readonly projectKey: string | null } {
  const on = (project: (typeof projects)[number], machine: string) =>
    project.projectRefs.some((ref) => String(ref.environmentId) === machine);
  // A machine with no project can't hold a new Cell.
  const machines = picks.machines.filter((machine) =>
    projects.some((project) => on(project, machine)),
  );
  const listed = projects.filter(
    (project) => machines.length === 0 || machines.some((machine) => on(project, machine)),
  );
  const chosen = inEffect(
    picks.projects,
    listed.map((project) => project.key),
  );
  return {
    machine: machines.length === 1 ? (machines[0] ?? null) : null,
    projectKey: chosen.length === 1 ? (chosen[0] ?? null) : null,
  };
}
