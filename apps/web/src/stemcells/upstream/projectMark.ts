/**
 * What a project's mark (`project/ProjectMark.tsx`) takes from upstream: the machine's folders
 * for Stemcells' own projects, whether upstream has an image for a project, the letters and
 * colour upstream derives from its name, an icon by its lucide name, and `ProjectFavicon`,
 * which finds and loads the image. `projectMark.contract.test.ts` pins what the mark relies on.
 */
import { useAtomValue } from "@effect/atom-react";
import { isProjectFaviconFallbackUrl } from "@t3tools/shared/projectFavicon";
import { Atom } from "effect/reactivity";
import { type ComponentType, createElement, lazy } from "react";

import type { ProjectFaviconProject } from "../../components/ProjectFavicon";
import { deriveProjectIdentity } from "../../projectIdentity";
import { projectFaviconUrlAtom } from "../../state/assets";
import { environmentServerConfigsAtom } from "../../state/server";
import { projectMarkOf, type ProjectMarkLook } from "../../../../../stemcells/brand/projectMark.ts";
import { ownProjectIn } from "./firstProject";

export { ProjectFavicon } from "../../components/ProjectFavicon";
export type { ProjectFaviconProject };

const NO_IMAGE = Atom.make<string | null>(null);

/** What `project`'s tile shows. */
export function useProjectMarkLook(project: ProjectFaviconProject): ProjectMarkLook {
  const config = useAtomValue(environmentServerConfigsAtom).get(project.environmentId);
  const own = ownProjectIn(project.workspaceRoot, config);
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
  const named = project.title.trim().length > 0 ? deriveProjectIdentity(project.title) : null;
  return projectMarkOf({
    own,
    icon: project.projectIcon,
    image: src !== null && !isProjectFaviconFallbackUrl(src),
    named: named && { letters: named.monogram, color: named.color },
  });
}

/** An icon by its lucide name, from upstream's one chunk of every lucide icon, loaded once used. */
export const LucideIconNamed = lazy(() =>
  import("../../lib/lucideIconByName").then(({ lucideIconByName }) => ({
    default: function LucideIconNamed(props: {
      readonly name: string;
      readonly fallback: ComponentType;
    }) {
      return createElement(lucideIconByName(props.name) ?? props.fallback);
    },
  })),
);
