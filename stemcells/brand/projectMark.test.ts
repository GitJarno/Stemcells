import { describe, expect, it } from "vite-plus/test";

import { MADE_FILL, ownProjectOf, projectMarkOf, type ProjectMarkLook } from "./projectMark.ts";

const named = { letters: "HA", color: "teal" };

describe("a project's mark", () => {
  it("shows what the project brings, each on the one tile", () => {
    const cases: Array<[Parameters<typeof projectMarkOf>[0], ProjectMarkLook]> = [
      [
        { own: null, icon: { kind: "monogram", text: "Q", color: "rose" }, image: true, named },
        { kind: "made", fill: MADE_FILL.rose!, letters: "Q", icon: null },
      ],
      [
        { own: null, icon: { kind: "lucide", name: "rocket", color: "blue" }, image: true, named },
        { kind: "made", fill: MADE_FILL.blue!, letters: "HA", icon: "rocket" },
      ],
      [
        { own: null, icon: { kind: "emoji", emoji: "🌊" }, image: true, named },
        { kind: "emoji", emoji: "🌊" },
      ],
      [{ own: null, icon: null, image: true, named }, { kind: "brand" }],
      [
        { own: null, icon: undefined, image: false, named },
        { kind: "made", fill: MADE_FILL.teal!, letters: "HA", icon: null },
      ],
      [{ own: null, icon: null, image: false, named: null }, { kind: "plain" }],
      [
        { own: "disk", icon: null, image: true, named },
        { kind: "own", own: "disk" },
      ],
      [
        {
          own: "scratch",
          icon: { kind: "lucide", name: "message-square-dashed", color: "gray" },
          image: false,
          named,
        },
        { kind: "own", own: "scratch" },
      ],
    ];
    for (const [input, look] of cases)
      expect(projectMarkOf(input), JSON.stringify(input)).toEqual(look);
  });

  it("draws a colour it doesn't know in gray, not in nothing", () => {
    const look = projectMarkOf({
      own: null,
      icon: { kind: "monogram", text: "Q", color: "chartreuse" },
      image: false,
      named,
    });
    expect(look).toMatchObject({ kind: "made", fill: MADE_FILL.gray });
  });
});

describe("Stemcells' own projects", () => {
  const same = (a: string, b: string) => a.replace(/\/+$/, "") === b.replace(/\/+$/, "");
  const config = {
    scratchWorkspaceRoot: "/home/cells/.stemcells/scratch",
    newProjectsRoot: "/home/cells/.stemcells/projects/",
  };

  it("are the scratch folder and the Disk folder among the machine's new projects", () => {
    expect(ownProjectOf("/home/cells/.stemcells/scratch/", config, same)).toBe("scratch");
    expect(ownProjectOf("/home/cells/.stemcells/projects/disk", config, same)).toBe("disk");
    expect(ownProjectOf("/home/cells/.stemcells/projects/harbor", config, same)).toBeNull();
    expect(ownProjectOf("/home/cells/code/disk", config, same)).toBeNull();
  });

  it("are none on a machine that names no such folders", () => {
    expect(ownProjectOf("/home/cells/.stemcells/projects/disk", {}, same)).toBeNull();
    expect(ownProjectOf("/home/cells/.stemcells/scratch", undefined, same)).toBeNull();
  });
});
