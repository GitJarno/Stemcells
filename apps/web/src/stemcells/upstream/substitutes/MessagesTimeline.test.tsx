/**
 * The timeline's substitute hands upstream's rows the chat's work verbs in our context, read off
 * the entries it draws: the working row and a turn's fold say the turn's verb, and outside the
 * substitute upstream's words. Upstream's timeline here is a stand-in drawing those two rows.
 */
import { MessageId, RunId } from "@t3tools/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

import { turnVerbsOf } from "../../verbs/turnVerbs";
import { workedLabel, workingWord } from "../../verbs/workVerbs";
import * as Stemcells from "../seams/chat";
import type { TimelineEntries } from "../workVerbs";
import { MessagesTimeline } from "./MessagesTimeline";

// Upstream's timeline loads the diff worker, which runs only in a browser:
// the stand-in below is all this test draws.
vi.mock(import("../../../components/chat/MessagesTimeline"), () => ({
  // The two rows that say a verb, inside upstream's timeline.
  MessagesTimeline: (() => (
    <p>
      <Stemcells.CellWorkingWord />|
      <Stemcells.CellWorkedLabel createdAt={time(1)} label="Worked for 20s" />
    </p>
  )) as never,
}));

const time = (second: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, second)).toISOString();

const asked = (text: string, second: number) => ({
  kind: "message" as const,
  id: text,
  createdAt: time(second),
  message: {
    id: MessageId.make(text),
    role: "user" as const,
    text,
    runId: RunId.make(`run-${second}`),
    createdAt: time(second),
    updatedAt: time(second),
    streaming: false,
  },
});

type TimelineProps = Parameters<typeof MessagesTimeline>[0];

const ENTRIES = [asked("fix the crash", 0), asked("polish the header", 30)] as TimelineEntries;

/** What the rows show, without the words a screen reader hears. */
const shown = (html: string) =>
  html
    .replaceAll(/<span class="sr-only[^"]*">[^<]*<\/span>/g, "")
    .replaceAll(/<[^>]+>/g, "")
    .replaceAll("&amp;", "&");

describe("the timeline's work verbs", () => {
  it("the substitute's rows say the chat's verbs, read off the entries it draws", () => {
    const verbs = turnVerbsOf(ENTRIES);
    expect(verbs.live).not.toBeNull();
    const html = renderToStaticMarkup(
      <MessagesTimeline {...({ timelineEntries: ENTRIES } as unknown as TimelineProps)} />,
    );
    // The working word is drawn twice over, the sheen's light on its text.
    const [working, worked] = shown(html).split("|");
    expect(working).toContain(workingWord(verbs.live));
    expect(working).not.toContain("Working");
    expect(worked).toBe(workedLabel(verbs.at(time(1)), "Worked for 20s"));
    expect(worked).not.toBe("Worked for 20s");
  });

  it("rows outside the substitute say upstream's words", () => {
    const html = renderToStaticMarkup(
      <p>
        <Stemcells.CellWorkingWord />|
        <Stemcells.CellWorkedLabel createdAt={time(1)} label="Worked for 20s" />
      </p>,
    );
    const [working, worked] = shown(html).split("|");
    expect(working).toContain("Working");
    expect(worked).toBe("Worked for 20s");
  });
});
