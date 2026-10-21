import { describe, expect, it, vi } from "vite-plus/test";

import { PACK_OUTFITS } from "./kit.ts";
import { looksOf, seasonOn } from "./looks.ts";
import { probesOf, sceneOf, wornLook } from "./scene.ts";

/** A theme of outfits and a moving feast, drawn as the packs in `art/packs/` are. */
vi.mock("./art.ts", () => {
  // A back piece reaches past the body's edge, where it shows.
  const piece = (name: string, slot: string, ink: string, width = slot === "back" ? 30 : 4) => ({
    name,
    slot,
    art: [ink.repeat(width)],
    hotspot: [width / 2, 1],
    mini: [ink.repeat(2)],
    miniHotspot: [1, 0],
  });
  const fabric = (ink: string) => [
    { parts: ["torso"], map: { B: ink, b: ink }, rides: false, rows: [26, 29], miniRows: [11, 13] },
  ];
  return {
    ART_PACKS: {
      crew: {
        theme: "crew",
        season: null,
        pieces: [
          piece("helm", "headwear", "q"),
          piece("hat", "headwear", "l"),
          piece("cap", "headwear", "A"),
          piece("band", "headwear", "W"),
          piece("cape", "back", "N"),
          piece("quiver", "back", "Z"),
        ],
        fabrics: { steel: fabric("q"), lilac: fabric("l"), sky: fabric("S"), rose: fabric("I") },
        outfits: [
          {
            id: "knight",
            headwear: "crew/helm",
            back: "crew/cape",
            fabric: "crew/steel",
            silhouette: "helm",
            family: "steel",
          },
          {
            id: "mage",
            headwear: "crew/hat",
            fabric: "crew/lilac",
            colourways: [
              { id: "sky", fabric: "crew/sky" },
              { id: "rose", fabric: "crew/rose" },
            ],
            silhouette: "hat",
            family: "lilac",
          },
          {
            id: "ranger",
            headwear: "crew/cap",
            back: "crew/quiver",
            silhouette: "cap",
            family: "green",
          },
          {
            id: "monk",
            headwear: "crew/band",
            fabric: "crew/steel",
            silhouette: "band",
            family: "steel",
          },
        ],
      },
      props: {
        theme: "props",
        season: null,
        // A pole on the back that reaches the canvas's top row at rest.
        pieces: [
          {
            name: "flag",
            slot: "back",
            art: Array.from({ length: 21 }, () => "N"),
            hotspot: [0, 20],
            mini: Array.from({ length: 11 }, () => "N"),
            miniHotspot: [0, 10],
          },
        ],
      },
      feast: {
        theme: "feast",
        season: { years: { "2027": ["02-06", "02-20"] } },
        pieces: [piece("lantern", "back", "N"), piece("crown", "headwear", "Y")],
      },
    },
    ART_MOVES: {},
    ART_TEMPERAMENTS: {},
  };
});

const CREW = { theme: "crew", seasons: true } as const;
const outfitOf = (id: string) => PACK_OUTFITS.get(id.slice("outfit:".length).split("~")[0]!)!;

describe("outfits, dealt as one", () => {
  it("deals each Cell one outfit, no two sharing a silhouette or a colour family", () => {
    const looks = looksOf(["Otter", "Puffin", "Wren"], "2027-03-01", new Map(), CREW);
    const worn = [...looks.values()].map((look) => look.worn);
    expect(worn.every((ids) => ids.length === 1 && ids[0]!.startsWith("outfit:crew/"))).toBe(true);
    const outfits = worn.map((ids) => outfitOf(ids[0]!));
    expect(new Set(outfits.map((o) => o.silhouette)).size).toBe(3);
    expect(new Set(outfits.map((o) => o.family)).size).toBe(3);
  });

  it("past the catalogue, wears the least worn, and an outfit worn twice in another colourway", () => {
    const crew = ["Otter", "Puffin", "Wren", "Heron", "Marten", "Lark", "Gannet", "Plover"];
    const ids = [...looksOf(crew, "2027-03-01", new Map(), CREW).values()].map((l) => l.worn[0]!);
    const mages = ids.filter((id) => id.startsWith("outfit:crew/mage"));
    expect(mages.length).toBeGreaterThan(1);
    expect(new Set(mages).size).toBe(Math.min(mages.length, 3));
    const counts = ["knight", "mage", "ranger", "monk"].map(
      (name) => ids.filter((id) => outfitOf(id).name === name).length,
    );
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it("a Cell keeps its outfit and colourway while others come and go", () => {
    const before = looksOf(["Otter", "Puffin", "Wren"], "2027-03-01", new Map(), CREW);
    const after = looksOf(["Wren", "Heron", "Marten"], "2027-03-01", before, CREW);
    expect(after.get("Wren")).toEqual(before.get("Wren"));
  });
});

describe("a season, dealt first and dated year by year when it moves", () => {
  it("is held on the days its year names, the narrower window over winter's", () => {
    expect(seasonOn("2027-02-06")).toBe("feast");
    expect(seasonOn("2027-02-20")).toBe("feast");
    expect(seasonOn("2027-02-21")).toBe("winter");
    expect(seasonOn("2028-02-10")).toBe("winter");
    expect(seasonOn("02-10")).toBe("winter");
  });

  it("gives every Cell the season's item, and the theme's outfit only where it fits beside it", () => {
    const crew = ["Otter", "Puffin", "Wren", "Heron", "Marten", "Lark"];
    const looks = [...looksOf(crew, "2027-02-10", new Map(), CREW).values()];
    expect(looks.every((look) => look.worn[0]!.startsWith("feast/"))).toBe(true);
    expect(new Set(looks.map((look) => look.worn[0])).size).toBe(2);
    for (const { worn } of looks) {
      // Every outfit of the theme wears a hat, so none fits beside the crown.
      if (worn[0] === "feast/crown") expect(worn).toHaveLength(1);
      else expect(outfitOf(worn[1]!).back).toBeUndefined();
    }
  });

  it("wears the season's piece with the outfit, the outfit's fabric kept", () => {
    const look = wornLook(["feast/lantern", "outfit:crew/mage~rose"]);
    expect(look.wardrobe).toMatchObject({
      headwear: "crew/hat",
      back: "feast/lantern",
      fabric: "crew/rose",
    });
    const rows = sceneOf(look, "idle")!.hero[0]!.join("");
    expect(rows).toContain("I");
    expect(rows).toContain("N");
  });
});

describe("a back piece that rises above the crown", () => {
  it("holds the hop down so the piece stays on the canvas, hero and miniature", () => {
    const look = wornLook(["props/flag"]);
    for (const compact of [false, true]) {
      const probes = probesOf(look, "happy", compact);
      expect(probes.length).toBeGreaterThan(1);
      expect(probes.map((probe) => probe.spilt)).toEqual(probes.map(() => 0));
    }
  });
});
