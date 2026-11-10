import { describe, expect, it } from "vite-plus/test";

import type { Need } from "../needs/derive.ts";
import { SAID_CAP, alertWords } from "./notify.ts";

const need = (over: Partial<Need> & Pick<Need, "kind">): Need => ({
  key: `thread-a:${over.kind}`,
  number: 1,
  threadId: "thread-a",
  projectId: "project-1",
  parentThreadId: null,
  title: "Export pages",
  providerInstanceId: "claude",
  since: "2026-11-04T00:00:00.000Z",
  blocks: false,
  request: null,
  plan: null,
  limit: null,
  failure: null,
  prose: null,
  stuck: null,
  brief: null,
  ...over,
});

const request = (over: Partial<NonNullable<Need["request"]>>): NonNullable<Need["request"]> => ({
  id: "request-1",
  kind: "user_input",
  prompt: null,
  appName: null,
  reason: null,
  fullAccessOverride: null,
  options: [],
  questions: [],
  responseMode: null,
  capability: "live",
  ...over,
});

const question = (text: string) => ({
  id: text,
  header: "",
  question: text,
  options: [],
  multiSelect: false,
  allowCustomAnswer: true,
});

const prose = (cue: NonNullable<Need["prose"]>["cue"], text: string): Need["prose"] => ({
  runId: "run-1",
  cue,
  text,
  steps: [],
  next: null,
  lead: null,
});

const bodyOf = (over: Partial<Need> & Pick<Need, "kind">) => alertWords(need(over)).body;

describe("what a push says", () => {
  it("asks the Cell's own question, under its title", () => {
    expect(
      alertWords(
        need({
          kind: "question",
          request: request({
            questions: [question("Keep the old column?"), question("And the header?")],
          }),
        }),
      ),
    ).toEqual({ title: "Export pages", body: "Keep the old column? (and 1 more)" });
  });

  it("finds the question at the end of a reply's last paragraph, without its markup", () => {
    expect(
      bodyOf({
        kind: "prose",
        prose: prose(
          "question",
          "I moved the tokens into `theme.css` and the tests pass. Should I **also** rename [the old file](https://example.com/old)?",
        ),
      }),
    ).toBe("Should I also rename the old file?");
  });

  it("names the command, the plan, the step and the error", () => {
    expect(
      bodyOf({ kind: "permission", request: request({ kind: "command", prompt: "pnpm test" }) }),
    ).toBe("Wants to run: pnpm test");
    expect(
      bodyOf({
        kind: "plan",
        plan: { id: "plan-1", runId: "run-1", title: "Split the export", steps: [], markdown: "" },
      }),
    ).toBe("Plan ready: Split the export");
    expect(bodyOf({ kind: "prose", prose: prose("left", "approve the billing change") })).toBe(
      "Your step: approve the billing change",
    );
    expect(
      bodyOf({
        kind: "failed",
        failure: { runId: "run-1", errorClass: "provider_error", message: "Overloaded" },
      }),
    ).toBe("Stopped with an error: Overloaded");
  });

  it("says the kind when the card has no words of its own", () => {
    expect(bodyOf({ kind: "question" })).toBe("Has a question");
    expect(bodyOf({ kind: "permission", request: request({ kind: "command" }) })).toBe(
      "Asks for permission",
    );
    expect(bodyOf({ kind: "prose", prose: prose("stopped", "Next, I will wire the phone.") })).toBe(
      "Stopped short of done",
    );
    expect(bodyOf({ kind: "limit" })).toBe("Hit its usage limit");
  });

  it("ends a long one at a word, inside what a lock screen shows", () => {
    const body = bodyOf({
      kind: "permission",
      request: request({ kind: "command", prompt: "pnpm exec vp test run ".repeat(20) }),
    });
    expect(body.length).toBeLessThanOrEqual(SAID_CAP + 1);
    expect(body.endsWith("…")).toBe(true);
  });
});
