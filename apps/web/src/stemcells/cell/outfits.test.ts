import { describe, expect, it, vi } from "vite-plus/test";

import { PACK_OUTFITS } from "./kit.ts";
import { castLookOf, looksOf, seasonOn } from "./looks.ts";
import { cellNameOf, NAMES } from "./name.ts";
import { probesOf, sceneOf, wornLook } from "./scene.ts";

/** A season of outfits, a moving feast and a cast, drawn as the packs in `art/packs/` are. */
vi.mock("./art.ts", async () => {
  const { NAMES: names } = await import("./name.ts");
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
        season: { from: "03-01", to: "03-10" },
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
      // A look for every name: a hat, and a fabric in two colourways.
      cast: {
        theme: "cast",
        season: null,
        cast: true,
        pieces: [],
        outfits: names.map((name: string) => ({
          id: name.toLowerCase(),
          headwear: "crew/hat",
          fabric: "crew/lilac",
          colourways: [{ id: "sky", fabric: "crew/sky" }],
          silhouette: name,
          family: "lilac",
        })),
      },
      // The same window as the original's `christmas`.
      yule: {
        theme: "yule",
        season: { from: "12-01", to: "12-26" },
        pieces: [piece("star", "headwear", "Y")],
      },
    },
    ART_MOVES: {},
    ART_TEMPERAMENTS: {},
  };
});

const outfitOf = (id: string) => PACK_OUTFITS.get(id.slice("outfit:".length).split("~")[0]!)!;

describe("a season's outfits, dealt as one on its feast", () => {
  it("deals each Cell one outfit, no two sharing a silhouette or a colour family", () => {
    const looks = looksOf(["Otter", "Puffin", "Wren"], "2027-03-01");
    const worn = [...looks.values()].map((look) => look.worn);
    expect(worn.every((ids) => ids[0]!.startsWith("outfit:crew/"))).toBe(true);
    const outfits = worn.map((ids) => outfitOf(ids[0]!));
    expect(new Set(outfits.map((o) => o.silhouette)).size).toBe(3);
    expect(new Set(outfits.map((o) => o.family)).size).toBe(3);
  });

  it("past the catalogue, wears the least worn, and an outfit worn twice in another colourway", () => {
    const crew = ["Otter", "Puffin", "Wren", "Heron", "Marten", "Lark", "Gannet", "Plover"];
    const ids = [...looksOf(crew, "2027-03-01").values()].map((l) => l.worn[0]!);
    const mages = ids.filter((id) => id.startsWith("outfit:crew/mage"));
    expect(mages.length).toBeGreaterThan(1);
    expect(new Set(mages).size).toBe(Math.min(mages.length, 3));
    const counts = ["knight", "mage", "ranger", "monk"].map(
      (name) => ids.filter((id) => outfitOf(id).name === name).length,
    );
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it("a Cell keeps its outfit and colourway while others come and go", () => {
    const before = looksOf(["Otter", "Puffin", "Wren"], "2027-03-01");
    const after = looksOf(["Wren", "Heron", "Marten"], "2027-03-01", before);
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

  it("goes to the pack drawn since when its window ties with the original's", () => {
    expect(seasonOn("12-10")).toBe("yule");
    expect(seasonOn("12-27")).toBe("newyear");
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

describe("a Cell's own look", () => {
  // Six chats that drew six names.
  const crew = ["Otter", "Puffin", "Wren", "Heron", "Marten", "Lark", "Gannet", "Plover"]
    .filter(
      (codename, i, all) => all.findIndex((c) => cellNameOf(c) === cellNameOf(codename)) === i,
    )
    .slice(0, 6);
  const own = (codename: string) => castLookOf(cellNameOf(codename))!;

  it("is its name's, worn every day", () => {
    expect(crew).toHaveLength(6);
    for (const [codename, look] of looksOf(crew, "2027-05-20"))
      expect(look.worn).toEqual([own(codename)]);
    expect(own("Otter")).toBe(`outfit:cast/${cellNameOf("Otter").toLowerCase()}`);
  });

  it("gives way to a season's outfit on a feast, and shares its slots with a season's piece", () => {
    for (const look of looksOf(crew, "2027-03-05").values()) {
      expect(look.worn).toHaveLength(1);
      expect(look.worn[0]).toMatch(/^outfit:crew\//);
    }
    for (const [codename, look] of looksOf(crew, "2027-02-10")) {
      expect(look.worn[0]).toMatch(/^feast\//);
      expect(look.worn[1]).toBe(own(codename));
    }
    const dressed = wornLook(["feast/lantern", own(crew[0]!)]);
    expect(dressed.wardrobe).toMatchObject({ back: "feast/lantern", headwear: "crew/hat" });
    expect(wornLook(["feast/crown", own(crew[0]!)]).wardrobe.headwear).toBe("feast/crown");
  });

  it("sets two Cells of one name apart by colourway, each keeping its own while in view", () => {
    const first = "cell-0";
    const twin = Array.from({ length: 5000 }, (_, i) => `cell-${i + 1}`).find(
      (codename) => cellNameOf(codename) === cellNameOf(first),
    )!;
    const both = looksOf([first, twin], "2027-05-20");
    expect(both.get(first)!.worn).toEqual([own(first)]);
    expect(both.get(twin)!.worn).toEqual([`${own(first)}~sky`]);
    expect(looksOf([twin], "2027-05-20", both).get(twin)).toEqual(both.get(twin));
    expect(looksOf([twin], "2027-05-20").get(twin)!.worn).toEqual([own(first)]);
  });

  it("is drawn for every name the mock holds", () => {
    expect(NAMES.every((name) => castLookOf(name) !== undefined)).toBe(true);
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
