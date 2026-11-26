/**
 * Upstream's timeline finds a citation's words in the text it draws (`findAssistantCitationText`)
 * and highlights them. The docked ask's "Where it asked" relies on finding the Cell's words
 * there, which its markdown no longer shows.
 */
import { findAssistantCitationText } from "@t3tools/shared/assistantCitations";
import { describe, expect, it } from "vite-plus/test";

import { askCitationOf } from "./askCitation";

const thread = { environmentId: "env-1", threadId: "thread-floof" };
const reply =
  "Built the **header** tokens.\n\nShould I ship `tokens.css` to [the site](https://example.com)?";
// What the timeline draws of `reply`.
const drawn = "Built the header tokens.\nShould I ship tokens.css to the site?";

describe("where the docked ask asked", () => {
  it("cites the asking words as the chat draws them", () => {
    const start = reply.indexOf("Should");
    const citation = askCitationOf(thread, { messageId: "m1", start, end: reply.length }, reply);
    expect(citation?.text).toBe("Should I ship tokens.css to the site?");
    const found = citation && findAssistantCitationText(drawn, citation);
    expect(found && drawn.slice(found.start, found.end)).toBe(
      "Should I ship tokens.css to the site?",
    );
  });

  it("cites a reply's opening when the ask quotes none of it", () => {
    const citation = askCitationOf(thread, { messageId: "m1", start: null, end: null }, reply);
    expect(citation && findAssistantCitationText(drawn, citation)).toEqual({ start: 0, end: 62 });
  });
});
