import { describe, expect, it } from "vite-plus/test";

import { planOf, proposedPlan, type Answer } from "./check.ts";
import { wantsCompiler } from "./gate.ts";
import { clampEffort, saysExactly } from "./names.ts";
import { piecesOf } from "./pieces.ts";
import { flyingOf, rowSays, showsUnder } from "./rows.ts";
import { DICTATED_NOTE, type CompileContext, type Plan, type StartAct } from "./plan.ts";
import {
  begun,
  callable,
  calledBack,
  counts,
  done,
  drop,
  failed,
  learnedOf,
  onOf,
  outcomeOf,
  send,
  setPlace,
  settled,
  started,
  startNow,
  toggle,
  trayOf,
  trayWith,
  unsendable,
} from "./tray.ts";
import { planIdOfFence, thinkWith } from "./wire.ts";
import { withoutLead } from "./words.ts";

const context = (over: Partial<CompileContext> = {}): CompileContext => ({
  places: [
    { id: "p-harbor", name: "Harbor" },
    { id: "p-atlas", name: "Atlas" },
    { id: "p-design", name: "Harbor Design", aliases: ["the design system"] },
  ],
  models: [
    {
      instanceId: "claudeAgent",
      id: "claude-fable-5-1",
      name: "Fable 5.1",
      provider: "claude",
      efforts: ["low", "medium", "high", "xhigh"],
      effortOption: "effort",
    },
    {
      instanceId: "codex",
      id: "gpt-6.1-sol",
      name: "Sol 6.1",
      provider: "codex",
      efforts: ["low", "medium", "high", "xhigh", "max"],
      effortOption: "reasoningEffort",
    },
  ],
  cells: [
    { threadId: "t-otter", name: "Otter" },
    { threadId: "t-badger", name: "Badger" },
  ],
  dictated: false,
  ...over,
});

/** The plan `answer` makes of `text`; the answer names pieces by a word each holds. */
function plan(
  text: string,
  answer: (n: (word: string) => number) => Answer,
  over: Partial<CompileContext> = {},
  final = false,
) {
  const all = context(over);
  const pieces = piecesOf(
    text,
    all.places.flatMap((place) => [place.name, ...(place.aliases ?? [])]),
  );
  const n = (word: string) => {
    const piece = pieces.find((p) => p.text.includes(word));
    if (!piece)
      throw new Error(`no piece holds "${word}": ${pieces.map((p) => p.text).join(" | ")}`);
    return piece.n;
  };
  let minted = 0;
  return planOf({
    id: "plan-1",
    text,
    pieces,
    answer: answer(n),
    context: all,
    mint: () => `thread-${++minted}`,
    final,
  });
}

const starts = (p: Plan) => p.acts.filter((act): act is StartAct => act.kind === "start");
const made = (result: ReturnType<typeof plan>): Plan => {
  if (!result.ok) throw new Error(result.failed.join("; "));
  return result.plan;
};

describe("a message cut into pieces", () => {
  it.each([
    "Fable agent on high, one for the product detail page about the gallery the second for Harbor's film detail page about showtimes one for Atlas posting the changelog and one Sol agent for copywriting for the drop ads",
    "Start three agents. First one fixes the header in Harbor.\n- second: the docs\n2. v2.1 of the parser; done",
    "  \n one word \n",
  ])("leaves no word out and none twice: %s", (text) => {
    const pieces = piecesOf(text);
    let at = 0;
    for (const piece of pieces) {
      expect(text.slice(at, piece.start).trim()).toBe("");
      expect(text.slice(piece.start, piece.end)).toBe(piece.text);
      at = piece.end;
    }
    expect(text.slice(at).trim()).toBe("");
  });

  it("cuts dictation where speech opens a new item", () => {
    const pieces = piecesOf(
      "Fable agent on high one for the product detail page about the gallery the second for Harbor's film detail page and one Sol agent for copywriting for the drop ads",
    ).map((p) => p.text);
    expect(pieces).toEqual([
      "Fable agent on high",
      "one for the product detail page about the gallery",
      "the second for Harbor's film detail page",
      "and one Sol agent for copywriting for the drop ads",
    ]);
  });

  it("keeps a version and a list number inside their piece", () => {
    expect(piecesOf("1. bump the parser to v2.1 today").map((p) => p.text)).toEqual([
      "1. bump the parser to v2.1 today",
    ]);
  });
});

describe("which part of Aski reads a message", () => {
  const names = new Set(["harbor", "harbor design", "fable", "sol"]);
  it.each([
    "start three agents, one for the header and one for the docs",
    "Fable agent on high for the product page",
    "one for the header in Harbor, the second for the docs in Atlas",
    "a new project called Vacuum Cleaners about a comparison site",
    "delete the Harbor project",
    "archive all the cells in Atlas",
    "Harbor fix the header",
    "In Harbor fix the importer, and once that's done write its changelog",
    "hey Harbor Design: tidy the tokens",
    "can you spin up two agents for the migration?",
    "spawn 3 Sol",
  ])("the compiler: %s", (text) => expect(wantsCompiler(text, names)).toBe(true));

  it.each([
    "how many cells are flying?",
    "what happened in Harbor yesterday",
    "in the morning I'll look at it",
    "where was that chat about the film page two days ago",
    "turn the sounds off",
    "Otter, rebase onto main",
    "which agent for the docs finished?",
    "thanks, that worked",
    "/compact",
  ])("the chat: %s", (text) => expect(wantsCompiler(text, names)).toBe(false));
});

describe("a name said exactly", () => {
  it("is the name, case, dashes and humps aside, or an alias", () => {
    expect(saysExactly("harbor-design", "Harbor Design")).toBe(true);
    expect(saysExactly("HarborDesign's", "Harbor Design")).toBe(true);
    expect(saysExactly("the design system", "Harbor Design", ["the design system"])).toBe(true);
    expect(saysExactly("harbour", "Harbor")).toBe(false);
    expect(saysExactly("Harbor", "Harbor Design")).toBe(false);
  });

  it("clamps an effort to the model's own ladder, rounding up", () => {
    expect(clampEffort("max", ["low", "medium", "high", "xhigh"])).toBe("xhigh");
    expect(clampEffort("extra high", ["low", "high", "xhigh"])).toBe("xhigh");
    expect(clampEffort("loud", ["low", "high"])).toBeNull();
  });
});

describe("what a Cell is told", () => {
  it.each([
    ["one Sol agent for copywriting for the drop ads", ["Sol"], "copywriting for the drop ads"],
    ["the second for Harbor's film detail page", [], "Harbor's film detail page"],
    ["Harbor: fix the header", ["Harbor"], "fix the header"],
    ["- another one for the docs site", [], "the docs site"],
    // Not provably setup: the words stay.
    ["First one fixes the header in Harbor", ["Harbor"], "First one fixes the header in Harbor"],
    ["look for the missing index", [], "look for the missing index"],
    ["one for all", [], "one for all"],
  ])("%s", (text, heard, told) => expect(withoutLead(text, heard)).toBe(told));
});

describe("the tier of a Cell", () => {
  const two = "one for the header in Harbor, another for the docs in harbour design";

  it("starts at once when its project is said exactly in its own words", () => {
    const p = made(
      plan(two, (n) => ({
        acts: [
          { kind: "start", pieces: [n("header")], place: "Harbor", placeHeard: "Harbor" },
          {
            kind: "start",
            pieces: [n("docs")],
            place: "Harbor Design",
            placeHeard: "harbour design",
          },
        ],
        setup: [],
        talk: [],
      })),
    );
    expect(starts(p).map((a) => [a.place?.name, a.place?.how, a.tier, a.why])).toEqual([
      ["Harbor", "exact", "start", []],
      // Heard near: it waits for the person, and nothing ran in the wrong repository.
      ["Harbor Design", "near", "check", ["place-near"]],
    ]);
    expect(starts(p)[0]!.words).toBe("the header in Harbor");
  });

  it("waits when Aski chose the project, or none fits", () => {
    const p = made(
      plan("one for the film page showtimes, another for the gallery", (n) => ({
        acts: [
          { kind: "start", pieces: [n("showtimes")], place: "Harbor" },
          { kind: "start", pieces: [n("gallery")] },
        ],
        setup: [],
        talk: [],
      })),
    );
    expect(starts(p).map((a) => [a.place?.how ?? null, a.why])).toEqual([
      ["picked", ["place-picked"]],
      [null, ["place-open"]],
    ]);
  });

  it("carries a place forward, and never backward past another", () => {
    const text =
      "In Harbor fix the header. Then update the footer. In Atlas write the docs. Also the readme";
    const p = made(
      plan(text, (n) => ({
        acts: [
          { kind: "start", pieces: [n("header")], place: "Harbor", placeHeard: "Harbor" },
          { kind: "start", pieces: [n("footer")], place: "Harbor", placeHeard: "Harbor" },
          { kind: "start", pieces: [n("docs")], place: "Atlas", placeHeard: "Atlas" },
          // The model reaches back past Atlas: code reads the sentence the other way.
          { kind: "start", pieces: [n("readme")], place: "Harbor", placeHeard: "Harbor" },
        ],
        setup: [],
        talk: [],
      })),
    );
    expect(starts(p).map((a) => a.tier)).toEqual(["start", "start", "start", "check"]);
    expect(starts(p)[3]!.why).toEqual(["place-apart"]);
  });

  it("gives a project said after a joining word to what follows it", () => {
    const text =
      "in Harbor I need an agent for the seat map and another for the ticket printer then in Atlas one for the tax report";
    const p = made(
      plan(text, (n) => ({
        acts: [
          { kind: "start", pieces: [n("seat map")], place: "Harbor", placeHeard: "Harbor" },
          { kind: "start", pieces: [n("ticket printer")], place: "Harbor", placeHeard: "Harbor" },
          { kind: "start", pieces: [n("tax report")], place: "Atlas", placeHeard: "Atlas" },
        ],
        setup: [n("then in Atlas")],
        talk: [],
      })),
    );
    expect(starts(p).map((a) => [a.words, a.tier])).toEqual([
      ["in Harbor I need an agent for the seat map", "start"],
      ["the ticket printer", "start"],
      ["the tax report", "start"],
    ]);
  });

  it("starts nothing in a project whose name hangs between two items", () => {
    // No punctuation and no joining word: "in Atlas" could end the first item or open the second.
    const text = "in Harbor one for the seat map in Atlas one for the tax report";
    const either = (first: string, second: string) =>
      starts(
        made(
          plan(text, (n) => ({
            acts: [
              { kind: "start", pieces: [n("seat map")], place: first, placeHeard: first },
              { kind: "start", pieces: [n("tax report")], place: second, placeHeard: second },
            ],
            setup: [],
            talk: [],
          })),
        ),
      ).map((a) => a.tier);
    expect(either("Harbor", "Atlas")).toEqual(["start", "check"]);
    expect(either("Atlas", "Atlas")).toEqual(["check", "check"]);
  });

  it("takes the first project a Cell's own words name, not one its task mentions", () => {
    const text =
      "one agent in Harbor to make the header match the one in Atlas. Another for the footer";
    const tierWith = (place: string) =>
      starts(
        made(
          plan(text, (n) => ({
            acts: [
              { kind: "start", pieces: [n("header")], place, placeHeard: place },
              { kind: "start", pieces: [n("footer")] },
            ],
            setup: [],
            talk: [],
          })),
        ),
      )[0]!.tier;
    expect([tierWith("Harbor"), tierWith("Atlas")]).toEqual(["start", "check"]);
  });

  it("gives a message's one place to every Cell, wherever it stands", () => {
    const p = made(
      plan("fix the header. Then update the footer. Both in Harbor", (n) => ({
        acts: [
          { kind: "start", pieces: [n("header")], place: "Harbor", placeHeard: "Harbor" },
          { kind: "start", pieces: [n("footer")], place: "Harbor", placeHeard: "Harbor" },
        ],
        setup: [n("Both")],
        talk: [],
      })),
    );
    expect(starts(p).map((a) => a.tier)).toEqual(["start", "start"]);
  });

  it("reads a group's model and effort onto each Cell, and never forces a check for them", () => {
    const text =
      "Fable agent on high, one for the gallery in Harbor, the second for the showtimes in Atlas, and one table agent for the ad copy in Harbor";
    const p = made(
      plan(text, (n) => ({
        acts: [
          {
            kind: "start",
            pieces: [n("gallery")],
            place: "Harbor",
            placeHeard: "Harbor",
            model: "Fable 5.1",
            modelHeard: "Fable",
            effort: "high",
          },
          {
            kind: "start",
            pieces: [n("showtimes")],
            place: "Atlas",
            placeHeard: "Atlas",
            model: "Fable 5.1",
            modelHeard: "Fable",
            effort: "high",
          },
          {
            kind: "start",
            pieces: [n("ad copy")],
            place: "Harbor",
            placeHeard: "Harbor",
            model: "Fable 5.1",
            modelHeard: "table",
          },
        ],
        setup: [n("on high")],
        talk: [],
      })),
    );
    expect(starts(p).map((a) => [a.model?.how, a.model?.effort?.level ?? null, a.tier])).toEqual([
      ["exact", "high", "start"],
      ["exact", "high", "start"],
      ["near", null, "start"],
    ]);
    expect(starts(p)[2]!.words).toBe("the ad copy in Harbor");
  });

  it("drops a model or an effort the person never said", () => {
    const p = made(
      plan("Harbor: fix the header", (n) => ({
        acts: [
          {
            kind: "start",
            pieces: [n("header")],
            place: "Harbor",
            placeHeard: "Harbor",
            model: "Sol 6.1",
            modelHeard: "Sol",
            effort: "max",
          },
        ],
        setup: [],
        talk: [],
      })),
    );
    expect([starts(p)[0]!.model, starts(p)[0]!.effort]).toEqual([null, null]);
    expect(starts(p)[0]!.words).toBe("fix the header");
  });

  it('reads a short model\'s name misheard before "agent"', () => {
    const p = made(
      plan("one soul agent for the ad copy in Atlas", (n) => ({
        acts: [
          {
            kind: "start",
            pieces: [n("ad copy")],
            place: "Atlas",
            placeHeard: "Atlas",
            model: "Sol 6.1",
            modelHeard: "soul",
          },
        ],
        setup: [],
        talk: [],
      })),
    );
    expect(starts(p)[0]!.model).toMatchObject({ name: "Sol 6.1", how: "near" });
  });

  it("drops a model heard in a word that only sounds like it, where no model stands", () => {
    const p = made(
      plan("Harbor: fix the users table", (n) => ({
        acts: [
          {
            kind: "start",
            pieces: [n("users")],
            place: "Harbor",
            placeHeard: "Harbor",
            model: "Fable 5.1",
            modelHeard: "table",
          },
        ],
        setup: [],
        talk: [],
      })),
    );
    expect(starts(p)[0]!.model).toBeNull();
  });

  it("drops a model read from a word that doesn't sound like it", () => {
    const p = made(
      plan("Harbor: fix the header", (n) => ({
        acts: [
          {
            kind: "start",
            pieces: [n("header")],
            place: "Harbor",
            placeHeard: "Harbor",
            model: "Fable 5.1",
            modelHeard: "header",
          },
        ],
        setup: [],
        talk: [],
      })),
    );
    expect([starts(p)[0]!.model, starts(p)[0]!.tier]).toEqual([null, "start"]);
  });

  it("waits on a risky sentence, and lets the other Cells start", () => {
    const p = made(
      plan("In Harbor fix the header. In Atlas drop the staging database", (n) => ({
        acts: [
          { kind: "start", pieces: [n("header")], place: "Harbor", placeHeard: "Harbor" },
          { kind: "start", pieces: [n("staging")], place: "Atlas", placeHeard: "Atlas" },
        ],
        setup: [],
        talk: [],
      })),
    );
    expect(starts(p).map((a) => [a.tier, a.why])).toEqual([
      ["start", []],
      ["check", ["risky"]],
    ]);
    const risky = starts(p)[1]!;
    expect(risky.words.slice(risky.risks[0]!.start, risky.risks[0]!.end)).toMatch(/drop/);
  });

  it("holds a deletion, and starts nothing else until it is dealt with", () => {
    const p = made(
      plan("delete the Harbor project. In Atlas write the docs", (n) => ({
        acts: [
          {
            kind: "destroy",
            target: "project",
            pieces: [n("delete")],
            place: "Harbor",
            placeHeard: "Harbor",
          },
          { kind: "start", pieces: [n("docs")], place: "Atlas", placeHeard: "Atlas" },
        ],
        setup: [],
        talk: [],
      })),
    );
    expect(p.acts.map((a) => [a.kind, a.tier, a.why])).toEqual([
      ["destroy", "hold", []],
      ["start", "check", ["after-hold"]],
    ]);
  });

  it("names the Cells a deletion means only from those awake", () => {
    const p = made(
      plan("archive Otter and Wren", (n) => ({
        acts: [
          { kind: "destroy", target: "cells", pieces: [n("archive")], cells: ["otter", "Wren"] },
        ],
        setup: [],
        talk: [],
      })),
    );
    expect(p.acts[0]).toMatchObject({
      kind: "destroy",
      cells: [{ threadId: "t-otter", name: "Otter" }],
    });
  });

  it("makes a new project a check, named as the person said it", () => {
    const p = made(
      plan("a new project called vacuum cleaners about a comparison site", (n) => ({
        acts: [
          {
            kind: "new",
            pieces: [n("vacuum")],
            place: "vacuum cleaners",
            placeHeard: "a new project called vacuum cleaners",
          },
        ],
        setup: [],
        talk: [],
      })),
    );
    expect(starts(p)[0]).toMatchObject({
      place: { id: null, name: "Vacuum Cleaners", how: "new" },
      tier: "check",
      why: ["new-project"],
    });
  });

  it("makes a count of Cells", () => {
    const p = made(
      plan("3 agents in Harbor on the flaky test", (n) => ({
        acts: [
          {
            kind: "start",
            pieces: [n("flaky")],
            place: "Harbor",
            placeHeard: "Harbor",
            count: 3,
          },
        ],
        setup: [],
        talk: [],
      })),
    );
    expect(starts(p).map((a) => [a.threadId, a.tier, a.why])).toEqual([
      ["thread-1", "start", []],
      ["thread-2", "start", []],
      ["thread-3", "start", []],
    ]);
  });

  it("says a dictated message is one", () => {
    const p = made(
      plan(
        "Harbor fix the header",
        (n) => ({
          acts: [{ kind: "start", pieces: [n("header")], place: "Harbor", placeHeard: "Harbor" }],
          setup: [],
          talk: [],
        }),
        { dictated: true },
      ),
    );
    expect(starts(p)[0]).toMatchObject({ note: DICTATED_NOTE, tier: "start", why: [] });
  });
});

describe("an answer that fails", () => {
  const text = "In Harbor fix the header. In Lantern write the docs";
  const answer = (n: (word: string) => number): Answer => ({
    acts: [
      { kind: "start", pieces: [n("header")], place: "Harbor", placeHeard: "Harbor" },
      { kind: "start", pieces: [n("docs")], place: "Lantern", placeHeard: "Lantern" },
    ],
    setup: [],
    talk: [],
  });

  it("names a project that isn't one, for the second try", () => {
    const result = plan(text, answer);
    expect(result).toEqual({
      ok: false,
      failed: [expect.stringContaining('"Lantern" is not in Projects')],
    });
  });

  it("leaves that project open on the last try, so nothing starts in a guess", () => {
    const p = made(plan(text, answer, {}, true));
    expect(starts(p).map((a) => [a.place?.name ?? null, a.tier])).toEqual([
      ["Harbor", "start"],
      [null, "check"],
    ]);
  });

  it("fails on words given to no one, then makes every Cell wait", () => {
    const some = (n: (word: string) => number): Answer => ({
      acts: [{ kind: "start", pieces: [n("header")], place: "Harbor", placeHeard: "Harbor" }],
      setup: [],
      talk: [],
    });
    expect(plan(text, some).ok).toBe(false);
    const p = made(plan(text, some, {}, true));
    expect([p.leftOver.length, starts(p)[0]!.why]).toEqual([1, ["left-over"]]);
  });

  it("fails on an answer with no shape", () => {
    expect(plan(text, () => ({ acts: "none" }) as unknown as Answer).ok).toBe(false);
  });
});

describe("a plan Aski's chat proposes", () => {
  it("always waits, with its words shown, and marks what is risky", () => {
    const plan = proposedPlan({
      id: "plan-2",
      cells: [
        {
          projectId: "harbor",
          projectName: "Harbor",
          title: "Reset the branch",
          words: "Force-push the release branch.",
        },
      ],
      mint: () => "thread-9",
    });
    expect(plan.acts[0]).toMatchObject({
      tier: "check",
      why: ["proposed", "risky"],
      place: { projectId: "harbor", how: "picked" },
    });
  });
});

describe("a plan as a client carries it out", () => {
  const two = () =>
    trayOf(
      made(
        plan("In Harbor fix the header. In harbour design tidy the tokens", (n) => ({
          acts: [
            { kind: "start", pieces: [n("header")], place: "Harbor", placeHeard: "Harbor" },
            {
              kind: "start",
              pieces: [n("tokens")],
              place: "Harbor Design",
              placeHeard: "harbour design",
            },
          ],
          setup: [],
          talk: [],
        })),
      ),
    );

  it("starts nothing by itself: every Cell waits for the person's Send", () => {
    const tray = two();
    expect(tray.acts.map((one) => one.status)).toEqual(["waiting", "waiting"]);
    expect([unsendable(tray), onOf(tray).length]).toEqual([null, 2]);
    expect(send(tray).acts.map((one) => one.status)).toEqual(["starting", "starting"]);
  });

  it("leaves out a Cell the person switched off, and takes it back when they switch it on", () => {
    const off = toggle(two(), 1);
    expect(onOf(off).map((one) => one.act.i)).toEqual([0]);
    expect(send(off).acts.map((one) => one.status)).toEqual(["starting", "dropped"]);
    expect(send(toggle(off, 1)).acts.map((one) => one.status)).toEqual(["starting", "starting"]);
    // With every Cell off there is nothing to send; a Cell that already started can't be switched off.
    expect(unsendable(toggle(off, 0))).toBe("nothing");
    const sent = send(off);
    expect(toggle(sent, 0)).toEqual(sent);
  });

  it("learns a name heard near only from the person's own Send", () => {
    const tray = two();
    expect(learnedOf(tray)).toEqual({ places: [], models: [] });
    expect(learnedOf(send(tray)).places).toEqual([
      { heard: "harbour design", name: "Harbor Design" },
    ]);
    // Switched off, its near name was never agreed to.
    expect(learnedOf(send(toggle(tray, 1))).places).toEqual([]);
    // A word that only stood in the message teaches nothing: "fix" would then mean that project.
    const odd = {
      ...tray,
      acts: tray.acts.map((one) =>
        one.act.kind === "start" && one.act.place?.how === "near"
          ? { ...one, act: { ...one.act, place: { ...one.act.place, heard: "fix" } } }
          : one,
      ),
    };
    expect(learnedOf(send(odd)).places).toEqual([]);
    // A place they picked instead teaches nothing: the word wasn't that project.
    const picked = send(setPlace(tray, 1, { id: "p-atlas", name: "Atlas" }));
    expect(learnedOf(picked)).toEqual({ places: [], models: [] });
    expect(picked.acts[1]!.act).toMatchObject({ place: { name: "Atlas", how: "exact" }, why: [] });
  });

  it("tells the server what came of each act, and knows when it is over", () => {
    // Before Send the server hears only that both wait: a switch is the person's own until then.
    expect(outcomeOf(toggle(two(), 1)).map((one) => one.status)).toEqual(["waiting", "waiting"]);
    const tray = started(send(toggle(two(), 1)), 0, 1_000);
    expect(outcomeOf(tray)).toEqual([
      { i: 0, status: "started" },
      { i: 1, status: "dropped" },
    ]);
    expect(settled(tray)).toBe(true);
    expect([callable(tray, 5_000).length, callable(tray, 20_000).length]).toEqual([1, 0]);
  });

  it("sends nothing while a deletion is held, or while a Cell left on has no project", () => {
    const tray = trayOf(
      made(
        plan("delete the Harbor project. In Atlas write the docs. Also the readme", (n) => ({
          acts: [
            {
              kind: "destroy",
              target: "project",
              pieces: [n("delete")],
              place: "Harbor",
              placeHeard: "Harbor",
            },
            { kind: "start", pieces: [n("docs")], place: "Atlas", placeHeard: "Atlas" },
            { kind: "start", pieces: [n("readme")] },
          ],
          setup: [],
          talk: [],
        })),
      ),
    );
    expect(unsendable(tray)).toBe("held");
    expect(send(tray)).toEqual(tray);
    // Dropped from its own card, the deletion holds nothing; a waiting Cell isn't dropped that way.
    expect(drop(tray, 0).acts[0]!.status).toBe("dropped");
    expect(drop(tray, 1)).toEqual(tray);
    // The deletion done, the Cell with no project still holds the whole Send: all or nothing.
    const after = done(tray, 0);
    expect(unsendable(after)).toEqual({ place: 2 });
    expect(send(after)).toEqual(after);
    // Switched off, or given a project, it no longer does.
    expect(send(toggle(after, 2)).acts.map((one) => one.status)).toEqual([
      "done",
      "starting",
      "dropped",
    ]);
    expect(
      send(setPlace(after, 2, { id: "p-atlas", name: "Atlas" })).acts.map((one) => one.status),
    ).toEqual(["done", "starting", "starting"]);
  });
});

describe("a Cell that comes after another", () => {
  const text = "In Harbor fix the importer. Once that's done write its changelog in Harbor";
  const chain = (over: Record<string, unknown> = {}) =>
    made(
      plan(text, (n) => ({
        acts: [
          { kind: "start", pieces: [n("importer")], place: "Harbor", placeHeard: "Harbor" },
          {
            kind: "start",
            pieces: [n("changelog")],
            place: "Harbor",
            placeHeard: "Harbor",
            after: [0],
            afterHeard: "Once that's done",
            ...over,
          },
        ],
        setup: [],
        talk: [],
      })),
    );

  it("waits for it only in the person's own words for an order, and only for an earlier Cell", () => {
    expect(starts(chain()).map((act) => act.after)).toEqual([undefined, [0]]);
    // Words that aren't in the message, or say no order, are the compiler's own idea.
    expect(starts(chain({ afterHeard: "after the importer" }))[1]!.after).toBeUndefined();
    expect(starts(chain({ afterHeard: "write its changelog" }))[1]!.after).toBeUndefined();
    // Itself, a later act, an act that isn't there: nothing can wait in a ring.
    expect(starts(chain({ after: [1, 2, 7, -1] }))[1]!.after).toBeUndefined();
  });

  it("waits for every Cell of a count", () => {
    const counted = made(
      plan(text, (n) => ({
        acts: [
          {
            kind: "start",
            pieces: [n("importer")],
            place: "Harbor",
            placeHeard: "Harbor",
            count: 2,
          },
          {
            kind: "start",
            pieces: [n("changelog")],
            place: "Harbor",
            placeHeard: "Harbor",
            after: [0],
            afterHeard: "Once that's done",
          },
        ],
        setup: [],
        talk: [],
      })),
    );
    expect(starts(counted).map((act) => act.after)).toEqual([undefined, undefined, [0, 1]]);
  });

  it("is queued by Send, and the person can start or drop it", () => {
    const tray = send(trayOf(chain()));
    expect(tray.acts.map((one) => one.status)).toEqual(["starting", "queued"]);
    // Nothing of it waits on the person: the plan's card over the composer can leave.
    expect(settled(started(tray, 0, 1_000))).toBe(true);
    expect(counts(tray)).toEqual({ flying: 1, waiting: 0, queued: 1 });
    expect(outcomeOf(tray)[1]).toEqual({ i: 1, status: "queued" });
    expect(startNow(tray, 1).acts[1]!.status).toBe("starting");
    expect(drop(tray, 1).acts[1]!.status).toBe("dropped");
    expect(begun(tray, 1).acts[1]!.status).toBe("started");
  });

  it("waits for no one when the Cell before it was switched off", () => {
    const alone = send(toggle(trayOf(chain()), 0));
    expect(alone.acts.map((one) => one.status)).toEqual(["dropped", "starting"]);
    // It is sent as a Cell of its own: no client asks the server to hold it.
    expect(starts(alone.plan)[1]!.after).toEqual([0]);
    expect(alone.acts[1]!.act).not.toHaveProperty("after");
    expect(rowSays(toggle(trayOf(chain()), 0), trayOf(chain()).acts[1]!, () => null).word).toBe("");
  });

  it("says on its row what it comes after, and why it won't start by itself", () => {
    // Before it is sent the row already says so: "Then", for the row right above it.
    const fresh = trayOf(chain());
    expect(rowSays(fresh, fresh.acts[1]!, () => null).word).toBe("Then");
    const tray = started(send(fresh), 0, 1_000);
    const queued = tray.acts[1]!;
    const first = starts(tray.plan)[0]!.threadId;
    const seen =
      (stage: "working" | "done", short = false) =>
      (threadId: string) =>
        threadId === first ? { stage, line: "Importer fixed.", short } : null;
    expect(rowSays(tray, queued, seen("working"))).toMatchObject({ stuck: null });
    expect(rowSays(tray, queued, seen("working")).word).toBe("Then");
    expect(rowSays(tray, queued, seen("done", true)).stuck).toMatch(/stopped short$/);
    expect(rowSays(failed(send(trayOf(chain())), 0, "no model"), queued, () => null).stuck).toMatch(
      /never started$/,
    );
    expect(rowSays(tray, tray.acts[0]!, seen("done"))).toEqual({
      word: "Landed",
      line: "Importer fixed.",
      stuck: null,
    });
    // A Cell that asks or landed no longer flies, whatever the tray last heard of it.
    expect([flyingOf(tray, seen("working")), flyingOf(tray, seen("done"))]).toEqual([1, 0]);
    expect(showsUnder(tray)).toBe(true);
    // Called back and dropped: nothing of the plan is left to stand under its message.
    expect(showsUnder(drop(calledBack(tray, 0), 1))).toBe(false);
  });

  it("stands as the server last knew it after a reload", () => {
    const tray = trayWith(chain(), [
      { i: 0, status: "started" },
      { i: 1, status: "queued" },
    ]);
    expect(tray.acts.map((one) => [one.status, one.startedAt])).toEqual([
      ["started", undefined],
      ["queued", undefined],
    ]);
  });
});

describe("where a Cell works", () => {
  const apart = (heard: string, said: boolean, text = `In Harbor fix the header ${heard}`) =>
    starts(
      made(
        plan(text, (n) => ({
          acts: [
            {
              kind: "start",
              pieces: [n("header")],
              place: "Harbor",
              placeHeard: "Harbor",
              apart: said,
              apartHeard: heard,
            },
          ],
          setup: [],
          talk: [],
        })),
      ),
    )[0]!.apart;

  it("is a worktree of its own, or the project's folder, only when the person said so", () => {
    expect(apart("in its own worktree", true)).toBe(true);
    expect(apart("on a separate branch", true)).toBe(true);
    expect(apart("in the same folder", false)).toBe(false);
    expect(apart("with no worktrees", false)).toBe(false);
    // The compiler's own idea, words that say the opposite, and words that say nothing of it.
    expect(apart("in its own worktree", true, "In Harbor fix the header")).toBeUndefined();
    expect(apart("with no worktrees", true)).toBeUndefined();
    expect(apart("fix the header", true)).toBeUndefined();
    expect(apart("in its own worktree", false)).toBeUndefined();
  });

  it("is not told to the Cell, which might then make a worktree itself", () => {
    const told = (text: string, heard: string, keep: boolean) =>
      starts(
        made(
          plan(text, (n) => ({
            acts: [
              {
                kind: "start",
                pieces: [n("header")],
                place: "Harbor",
                placeHeard: "Harbor",
                apart: keep,
                apartHeard: heard,
              },
            ],
            setup: [],
            talk: [],
          })),
        ),
      )[0]!.words;
    expect(
      told(
        "In Harbor fix the header in its own worktree, then run the tests",
        "in its own worktree",
        true,
      ),
    ).toBe("In Harbor fix the header, then run the tests");
    // Words the checks didn't take as where it works stay the Cell's own.
    expect(told("In Harbor fix the header of the worktree page", "worktree page", false)).toBe(
      "In Harbor fix the header of the worktree page",
    );
  });
});

describe("the wire", () => {
  it("reads a plan's id from its fence, and nothing else", () => {
    expect(planIdOfFence("\n3f2a9c1e-77aa-4c1b-9d7e-0a1b2c3d4e5f\n")).toBe(
      "3f2a9c1e-77aa-4c1b-9d7e-0a1b2c3d4e5f",
    );
    expect(planIdOfFence("rm -rf")).toBeNull();
    // A `plan` block written for another reason stays the code it is.
    expect(planIdOfFence("first-step-then-second")).toBeNull();
    expect(planIdOfFence("3f2a9c1e-77aa-4c1b-9d7e-0a1b2c3d4e5f and more")).toBeNull();
  });

  it("thinks with the fast model first and a stronger one second", () => {
    const models = [
      {
        instanceId: "claudeAgent",
        id: "claude-opus-5-5",
        efforts: ["low", "high"],
        effortOption: "effort",
      },
      {
        instanceId: "claudeAgent",
        id: "claude-haiku-5-5",
        efforts: ["low", "high"],
        effortOption: "effort",
      },
      { instanceId: "codex", id: "gpt-6.1-sol", efforts: [] },
    ];
    expect(thinkWith(models, "claudeAgent")).toEqual({
      fast: {
        instanceId: "claudeAgent",
        model: "claude-haiku-5-5",
        options: [{ id: "effort", value: "low" }],
      },
      strong: {
        instanceId: "claudeAgent",
        model: "claude-opus-5-5",
        options: [{ id: "effort", value: "low" }],
      },
    });
    expect(thinkWith(models, "codex")).toEqual({
      fast: { instanceId: "codex", model: "gpt-6.1-sol" },
    });
    expect(thinkWith(models, "cursor")).toBeNull();
  });
});
