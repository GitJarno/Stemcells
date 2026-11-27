/**
 * What carrying a plan out relies on upstream (`askiPlans.ts`): a project removed from the app
 * keeps its folder, as the deletion's card tells the person before their hand goes down; the
 * app's own Remove sends the command ours sends; and a new project is made from its name alone.
 */
import { describe, expect, it } from "vite-plus/test";

import projectCommands from "../../../../server/src/orchestration-v2/ProjectCommands.ts?raw";
import projectSettings from "../../components/settings/ProjectSettingsPanel.tsx?raw";
import newProject from "../../hooks/useNewProject.ts?raw";

describe("what a plan's hands rely on upstream", () => {
  it("deleting a project records it deleted and touches no folder", () => {
    const deletes = projectCommands.slice(projectCommands.indexOf('case "project.delete": {'));
    expect(deletes).toMatch(
      /^case "project\.delete": \{\s*if \(activeProject === undefined\) return missingProject\(\);\s*(?:\/\/[^\n]*\s*)*return Result\.succeed\(\{\s*\.\.\.base,\s*type: "project\.deleted",\s*payload: \{ projectId: command\.projectId, deletedAt: occurredAt \},\s*\}\);\s*\}/,
    );
    expect(projectCommands).not.toMatch(/\brm\(|removeSync|rmdir|FileSystem\.remove/);
  });

  it("Settings removes a project with the command ours sends, forced, on each machine that lists it", () => {
    expect(projectSettings).toMatch(
      /for \(const member of members\) \{[\s\S]{0,500}?await deleteProject\(\{\s*environmentId: member\.environmentId,\s*input: \{\s*projectId: member\.id,\s*force: true,\s*\},\s*\}\)/,
    );
  });

  it("a new project is made from its name, and answers the project it made", () => {
    expect(newProject).toMatch(
      /await createNew\(\{\s*environmentId: input\.environmentId,\s*input: \{ name: input\.name \},\s*\}\);/,
    );
    expect(newProject).toMatch(/const \{ projectId, workspaceRoot, commitError \} = result\.value;/);
  });
});
