/**
 * Ordinary prose never moves a chat or loses words. The bug: a draft's
 * "Without using any tools, write an 800-word essay about moss in plain
 * prose." was read as the place plain-project, by a near spelling; the
 * chat started there and was sent without "in plain prose". Each sentence
 * here says "in", "for" or "with" before a word that is only a prefix, a
 * part or a near spelling of a project's name, or uses a model, effort or
 * count word as a plain word. None may route, ink or strip anything.
 */
import { describe, expect, it } from "vite-plus/test";

import { modelLexicon } from "./catalog";
import { launchOf } from "./cells";
import { testCatalog, testPlaces } from "./fixtures/catalog";
import { roster } from "./places";
import { readWords } from "./read";
import { setupEdits } from "./send";

const ctx = {
  door: "draft" as const,
  roster: roster([
    ...testPlaces,
    ...["plain-project", "server-kit", "Placeholder", "moss-dark", "notes-app"].map((name) => ({
      id: name,
      name,
    })),
  ]),
  models: modelLexicon(testCatalog),
};

const PROSE = [
  "Without using any tools, write an 800-word essay about moss in plain prose.",
  "Write it in plain words, with no jargon.",
  "Keep the copy in plain English.",
  "Look for the error in server logs and explain it.",
  "The bug shows in serve mode only.",
  "Fix it in place without moving the file.",
  "Do it for real this time.",
  "Handle the migration with care.",
  "Write tests for plain inputs.",
  "Size the pool for server load.",
  "Fill the form with place names.",
  "Draw the chart with dark colours.",
  "Take a screenshot in dark mode.",
  "Write the summary in notes form.",
  "Test the sensor out in the field tomorrow.",
  "Is this licence fine for personal use?",
  "Show the cart in the shop header.",
  "Profile it for performance before we ship.",
  "Light the hallway with a lantern.",
  "Put the draft in review when it's done.",
  "Explain how to grow organs with stem cells.",
  "Sort the items in price order.",
  "Plan the menu for the holiday weekend.",
  "Write a short story set in a harbour town.",
  "Write a story about a harbor in winter.",
  "Write a haiku about moss.",
  "Write a sonnet about the sea in plain prose.",
  "Make a poem with haiku structure.",
  "Study with flash cards every night.",
  "Keep the volume low in the demo.",
  "Set the bar high for the launch.",
  "Run the fan at max speed.",
  "Explain how two cells divide during mitosis.",
  "Write three sessions of notes for the workshop.",
];

describe("ordinary prose", () => {
  it.each(PROSE)("leaves %j as written", (text) => {
    const facts = readWords(text, ctx);
    const read = {
      routing: facts.routing.map((h) => h.heard),
      quiet: facts.quiet.map((q) => q.place.place.name),
      grammar: facts.grammar.map((s) => text.slice(s.start, s.end)),
      launch: launchOf(facts) !== null,
      place: facts.groups.map((g) => g.place?.heard ?? null),
      models: facts.groups.flatMap((g) => (g.model ? [g.model.form.words.join(" ")] : [])),
    };
    expect(read).toEqual({
      routing: [],
      quiet: [],
      grammar: [],
      launch: false,
      place: [null],
      models: [],
    });
    expect(setupEdits(text, facts.grammar, { code: new Set(), markers: new Set() })).toBeNull();
  });
});
