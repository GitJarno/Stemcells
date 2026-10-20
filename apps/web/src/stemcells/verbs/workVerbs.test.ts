import { describe, expect, it } from "vite-plus/test";

import {
  chain,
  mix,
  pick,
  poolFor,
  TOPICS,
  topicOf,
  verbNamed,
  WORK_VERBS,
  workedLabel,
  workingWord,
  type WorkVerb,
} from "./workVerbs";

const named = (present: string): WorkVerb => {
  const verb = verbNamed(present);
  if (!verb) throw new Error(`no verb ${present}`);
  return verb;
};

describe("the work verbs' table", () => {
  it("gives every verb its own past form, a span, and room on the row", () => {
    expect(new Set(WORK_VERBS.map((verb) => verb.present)).size).toBe(WORK_VERBS.length);
    for (const verb of WORK_VERBS) {
      expect(verb.past, verb.present).not.toBe("");
      expect(verb.past, verb.present).not.toBe(verb.present);
      if (!verb.favourite) expect(verb.present.length, verb.present).toBeLessThanOrEqual(16);
      expect(verb.present.split(" ").length, verb.present).toBeLessThanOrEqual(2);
      expect(verbNamed(verb.present)).toBe(verb);
    }
    expect(verbNamed("Speedrunning")?.past).toBe("Speedran");
    expect(verbNamed("Overthinking")?.past).toBe("Overthought");
    expect(verbNamed("Locking in")?.past).toBe("Locked in");
    expect(verbNamed("Mogging")).toBeNull();
  });

  // A verb never names work a Cell could really be doing: "Rebranding" makes
  // a person ask whether it is actually rebranding. No entry may hold one of
  // these stems.
  it("never names real work a person could take literally", () => {
    const misleading = [
      "ship",
      "deploy",
      "launch",
      "release",
      "test",
      "debug",
      "fix",
      "refactor",
      "build",
      "compil",
      "commit",
      "merg",
      "install",
      "migrat",
      "diagnos",
      "triag",
      "prescrib",
      "validat",
      "process",
      "pivot",
      "brand",
      "unpack",
      "compos",
      "journal",
      "sketch",
      "kern",
      "respawn",
      "stream",
      "scal",
      "bootstrap",
      "dogfood",
      "growth",
      "ideat",
      "leverag",
      "circl",
      "uplevel",
      "a/b",
      "wip",
      "tank",
    ];
    const literal = WORK_VERBS.flatMap((verb) => {
      const words = `${verb.present} ${verb.past}`.toLowerCase();
      const stem = misleading.find((stem) => words.includes(stem));
      return stem ? [`${verb.present} (${stem})`] : [];
    });
    expect(literal).toEqual([]);
  });

  it("leaves every topic room to avoid a repeat, and the general pool wide", () => {
    for (const topic of TOPICS) expect(poolFor(topic).length, topic).toBeGreaterThanOrEqual(2);
    expect(poolFor(null).length).toBeGreaterThanOrEqual(40);
    expect(poolFor(null)).not.toContain(named("Yeeting"));
    expect(poolFor("remove")).toContain(named("Yeeting"));
  });

  it("weights a favourite about twice the rest of its pool", () => {
    const counts = new Map<string, number>();
    for (let seed = 0n; seed < 60_000n; seed += 1n) {
      const { present } = pick(seed, "fix the crash");
      counts.set(present, (counts.get(present) ?? 0) + 1);
    }
    const ratio = (counts.get("Goblinmaxxing") ?? 0) / (counts.get("Gremlining") ?? 1);
    expect(ratio).toBeGreaterThan(1.6);
    expect(ratio).toBeLessThan(2.4);
  });
});

describe("picking a turn's verb", () => {
  it("picks the same verb for one seed, every time", () => {
    for (const seed of [0n, 1n, 42n, 9_000_123n, (1n << 64n) - 1n]) {
      expect(pick(seed, "Add a settings toggle")).toBe(pick(seed, "Add a settings toggle"));
    }
    // SplitMix64, pinned: a change to it changes the word on every turn.
    expect(mix(0n)).toBe(0xe220a8397b1dcdafn);
    const words = new Set(
      Array.from({ length: 200 }, (_, i) => pick(BigInt(i) * 7919n, "").present),
    );
    expect(words.size).toBeGreaterThan(30);
  });

  it("reads the topic off the person's words: whole words, any case, the earliest", () => {
    expect(topicOf("Fix the crash on launch")).toBe("fix");
    expect(topicOf("the BUG is back")).toBe("fix");
    expect(topicOf("Polish the colour of the header")).toBe("design");
    expect(topicOf("verify the gate")).toBe("test");
    expect(topicOf("why does this hang?")).toBe("research");
    expect(topicOf("Implement the toggle")).toBe("build");
    expect(topicOf("Let's plan the week")).toBe("plan");
    expect(topicOf("simplify this")).toBe("refactor");
    expect(topicOf("drop the old table")).toBe("remove");
    expect(topicOf("prefix suffix fixture")).toBeNull();
    expect(topicOf("hello there")).toBeNull();
    expect(topicOf(`${"x ".repeat(400)}fix`)).toBeNull();
    for (let seed = 0n; seed < 300n; seed += 1n) {
      expect(pick(seed, "fix the crash").topics.has("fix")).toBe(true);
    }
  });

  it("never says the same verb twice in a row, even from a narrow pool", () => {
    for (let chat = 0; chat < 50; chat += 1) {
      const prompts = Array.from({ length: 40 }, (_, i) => ({
        id: `chat-${chat}-prompt-${i}`,
        text: "delete the old file",
      }));
      const verbs = chain(prompts);
      for (let i = 1; i < prompts.length; i += 1) {
        expect(verbs.get(prompts[i]!.id)).not.toBe(verbs.get(prompts[i - 1]!.id));
      }
    }
  });

  it("keeps a turn's verb by its prompt's id, and opens each chat on its own", () => {
    const prompts = [
      { id: "prompt-a", text: "fix it" },
      { id: "prompt-b", text: "polish the header" },
      { id: "prompt-c", text: "hm" },
    ];
    expect(chain(prompts)).toEqual(chain(prompts));
    const firsts = new Set(
      Array.from(
        { length: 40 },
        (_, i) => chain([{ id: `first-${i}`, text: "hello" }]).get(`first-${i}`)!.present,
      ),
    );
    expect(firsts.size).toBeGreaterThan(10);
  });
});

describe("the words on the row", () => {
  const gremlin = named("Gremlining");
  const sent = named("Sending it");

  it("says the verb where upstream said Working, and Worked", () => {
    expect(workingWord(gremlin)).toBe("Gremlining");
    expect(workedLabel(gremlin, "Worked for 3m 12s")).toBe("Gremlined for 3m 12s");
    expect(workedLabel(sent, "Worked for 3m 12s")).toBe("Sent it in 3m 12s");
    expect(workedLabel(gremlin, "Worked")).toBe("Gremlined");
  });

  it("says upstream's plain words without a verb", () => {
    expect(workingWord(null)).toBe("Working");
    expect(workedLabel(null, "Worked for 3m 12s")).toBe("Worked for 3m 12s");
  });

  it("never jokes about a stopped turn", () => {
    expect(workedLabel(gremlin, "You stopped after 3m")).toBe("You stopped after 3m");
    expect(workedLabel(gremlin, "You stopped this response")).toBe("You stopped this response");
  });
});
