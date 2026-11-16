// The app's projects, handed to `firstProject.ts`, which can't import the app's state itself.
import { appAtomRegistry } from "../../rpc/atomRegistry";
import { readProjects } from "../../state/entities";
import { environmentServerConfigsAtom } from "../../state/server";
import { isAsideWorkspace, readProjectFactsFrom } from "./firstProject";

readProjectFactsFrom(() => {
  const configs = appAtomRegistry.get(environmentServerConfigsAtom);
  return readProjects().map((project) => ({
    environmentId: project.environmentId,
    id: project.id,
    aside: isAsideWorkspace(project.workspaceRoot, configs.get(project.environmentId)),
  }));
});
