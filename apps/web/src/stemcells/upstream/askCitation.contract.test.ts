/**
 * Upstream's timeline finds a citation's words in the text it draws (`findAssistantCitationText`,
 * which its highlight range reads too). The ask's highlights in the reply, and its lines' jumps,
 * rely on finding the Cell's words there, which its markdown no longer shows.
 */
import { findAssistantCitationText } from "@t3tools/shared/assistantCitations";
import { describe, expect, it } from "vite-plus/test";

import { askCitationOf } from "./askCitation";

const thread = { environmentId: "env-1", threadId: "thread-floof" };
const reply =
  "Built the **header** tokens.\n\nShould I ship `tokens.css` to [the site](https://example.com)?";
// What the timeline draws of `reply`.
const drawn = "Built the header tokens.\nShould I ship tokens.css to the site?";

describe("the words an ask was built from", () => {
  it("cites the asking words as the chat draws them", () => {
    const start = reply.indexOf("Should");
    const citation = askCitationOf(thread, "m1", reply, { start, end: reply.length });
    expect(citation?.text).toBe("Should I ship tokens.css to the site?");
    const found = citation && findAssistantCitationText(drawn, citation);
    expect(found && drawn.slice(found.start, found.end)).toBe(
      "Should I ship tokens.css to the site?",
    );
  });

  it("cites a reply's opening when the ask quotes none of it", () => {
    const citation = askCitationOf(thread, "m1", reply, null);
    expect(citation && findAssistantCitationText(drawn, citation)).toEqual({ start: 0, end: 62 });
  });
});
