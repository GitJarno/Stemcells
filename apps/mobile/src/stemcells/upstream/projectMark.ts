// What a project's mark (`project/ProjectMark.tsx`) takes from upstream: the machine's folders for
// Stemcells' own projects, whether upstream has an image for a project, the letters and colour
// upstream derives from its name, the symbol upstream draws for an icon's lucide name, and
// `ProjectFavicon`, which finds and loads the image.

import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import { normalizeProjectPathForComparison } from "@t3tools/shared/path";
import { isProjectFaviconFallbackUrl } from "@t3tools/shared/projectFavicon";
import { Atom } from "effect/reactivity";

import { projectAutoMonogram, resolveProjectIconSymbol } from "../../lib/projectIcon";
import { useServerConfigs } from "../../state/entities";
import { projectFaviconUrlAtom } from "../../state/assets";
import {
  ownProjectOf,
  projectMarkOf,
  type ProjectMarkLook,
} from "../../../../../stemcells/brand/projectMark.ts";

export { ProjectFavicon } from "../../components/ProjectFavicon";
export { countGlyphs } from "../../lib/projectIcon";

export type MarkedProject = Pick<
  EnvironmentProject,
  "environmentId" | "workspaceRoot" | "title" | "faviconPath" | "projectIcon"
>;

const NO_IMAGE = Atom.make<string | null>(null);

const sameFolder = (a: string, b: string) => {
  const folder = normalizeProjectPathForComparison(b);
  return folder.length > 0 && normalizeProjectPathForComparison(a) === folder;
};

/** What `project`'s tile shows. */
export function useProjectMarkLook(project: MarkedProject): ProjectMarkLook {
  const config = useServerConfigs().get(project.environmentId);
  const own = ownProjectOf(project.workspaceRoot, config, sameFolder);
  // Upstream asks for an image only when the project has no icon of its own.
  const asks = own === null && project.projectIcon == null;
  const src = useAtomValue(
    asks
      ? projectFaviconUrlAtom({
          environmentId: project.environmentId,
          cwd: project.workspaceRoot,
          faviconPath: project.faviconPath,
        })
      : NO_IMAGE,
  );
  const named = projectAutoMonogram(project.title);
  return projectMarkOf({
    own,
    icon: project.projectIcon,
    image: src !== null && !isProjectFaviconFallbackUrl(src),
    named: named?.kind === "monogram" ? { letters: named.text, color: named.color } : null,
  });
}

/** The symbol upstream draws for a lucide icon's name; null where it draws letters instead. */
export function symbolForIcon(name: string) {
  return resolveProjectIconSymbol({ kind: "lucide", name, color: "gray" })?.name ?? null;
}
