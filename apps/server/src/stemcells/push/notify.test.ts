import { describe, expect, it } from "vite-plus/test";

import type { Condition } from "../needs/conditions.ts";
import type { Need } from "../needs/derive.ts";
import { SAID_CAP, alertWords, conditionWords } from "./notify.ts";

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
        kind: "permission",
        request: request({ kind: "file-change", prompt: "src/__snapshots__/theme_dark.css" }),
      }),
    ).toBe("Wants to change: src/__snapshots__/theme_dark.css");
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
    expect(bodyOf({ kind: "stuck" })).toBe("Has gone quiet");
  });

  it("ends a long one at a word, inside what a lock screen shows", () => {
    const body = bodyOf({
      kind: "permission",
      request: request({ kind: "command", prompt: "pnpm exec vp test run ".repeat(20) }),
    });
    expect(body.length).toBeLessThanOrEqual(SAID_CAP + 1);
    expect(body.endsWith("…")).toBe(true);
    const asked = bodyOf({
      kind: "question",
      request: request({
        questions: [question("Keep the old column? ".repeat(20)), question("And the header?")],
      }),
    });
    expect(asked.length).toBeLessThanOrEqual(SAID_CAP + 1);
    expect(asked.endsWith("… (and 1 more)")).toBe(true);
  });

  it("says a limit once for the Cells it holds: how many, until when, and whether they carry on", () => {
    const now = Date.parse("2026-11-04T10:00:00.000Z");
    const held = (title: string) => ({
      threadId: title,
      projectId: "project-1",
      title,
      since: "2026-11-04T09:58:00.000Z",
      carriesOn: true,
    });
    const limit: Condition = {
      key: "limit:claude:1",
      kind: "limit",
      providerInstanceId: "claude",
      resetAt: "2026-11-04T15:00:00.000Z",
      since: "2026-11-04T09:58:00.000Z",
      waits: "reset",
      cells: [held("Export pages"), held("Header tokens")],
    };
    const bodyAt = (over: Partial<Condition>) =>
      conditionWords({ ...limit, ...over }, now, "en-GB", "UTC").body;
    expect(conditionWords(limit, now, "en-GB", "UTC")).toEqual({
      title: "Usage limit reached",
      body: "2 Cells hold until 15:00, then carry on by themselves.",
    });
    expect(bodyAt({ resetAt: "2026-11-06T01:00:00.000Z", cells: [held("Export pages")] })).toBe(
      "Export pages holds until Friday 01:00, then carries on by itself.",
    );
    expect(bodyAt({ waits: "you" })).toBe("2 Cells hold. The limit resets 15:00.");
    expect(bodyAt({ waits: "you", resetAt: null })).toBe(
      "2 Cells hold. The limit didn't say when it resets.",
    );
  });

  it("keeps a key out of the command it shows", () => {
    expect(
      bodyOf({
        kind: "permission",
        request: request({
          kind: "command",
          prompt: 'API_KEY=abc123 curl -H "Authorization: Bearer abc123" --token abc123 my_host',
        }),
      }),
    ).toBe('Wants to run: API_KEY=… curl -H "Authorization: Bearer … --token … my_host');
  });
});
