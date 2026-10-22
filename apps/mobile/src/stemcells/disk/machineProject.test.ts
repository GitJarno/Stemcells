import { describe, expect, it } from "vite-plus/test";

import { projectOn } from "./machineProject";

describe("a cleanup Cell's project", () => {
  const projects = [
    { environmentId: "laptop", id: "web" },
    { environmentId: "mini", id: "media" },
    { environmentId: "mini", id: "backups" },
  ];

  it("is on the machine it frees, even when the first project is elsewhere", () => {
    expect(projectOn("mini", projects)?.id).toBe("media");
  });

  it("is none when the machine has no project", () => {
    expect(projectOn("studio", projects)).toBeNull();
  });
});
