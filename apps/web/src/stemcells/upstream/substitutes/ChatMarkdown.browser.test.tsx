/**
 * Upstream's markdown keeps a `t3-context://` link and hands it to the substitute's renderer: a
 * setting draws as its switch, another Cell as its token, a closed `chart` fence as its chart.
 * Upstream's row for an assistant's reply hands this markdown the reply's own words, whose
 * close-out draws as a card.
 */
import "../../../index.css";

import { MessageId, RunId, type ScopedThreadRef } from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import { RUN_SHOWS } from "../../../../../../stemcells/words/closeOut.ts";
import {
  TimelineRowActivityCtx,
  TimelineRowCtx,
  type TimelineRowActivityState,
  type TimelineRowSharedState,
} from "../../../components/chat/timelineRowContext";
import { chatMarkdownClipboardPayload } from "../../../markdown-clipboard";
import { setAskiPlans, useAskiPlans } from "../../aski/planning";
import type { CellStanding } from "../../needs/wire";
import { render } from "../testRender";
import ChatMarkdown from "./ChatMarkdown";
import { AssistantTimelineRow } from "./TimelineAssistantRows";

const beside = vi.hoisted(() => vi.fn((_cell: unknown) => true));
vi.mock("../../tabs/commands", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../tabs/commands")>()),
  openCellBeside: beside,
}));
// The chat's project holds Manatee; upstream's shells aren't loaded here.
vi.mock("../cellNames", () => ({
  useNamedCells: (ref: unknown) =>
    ref == null
      ? { signature: "", names: new Map() }
      : { signature: "Manatee=thread-m", names: new Map([["Manatee", "thread-m"]]) },
}));

// The server's list, as its stream would bring it: no server answers here.
const needs = vi.hoisted(() => ({ cells: null as ReadonlyArray<unknown> | null }));
vi.mock("../../needs/stream", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../needs/stream")>()),
  useNeeds: () => ({ needs: null, cells: needs.cells, live: true }),
}));

function Plans() {
  return <output>{useAskiPlans() ? "on" : "off"}</output>;
}

describe("a setting in a reply", () => {
  it("draws as its switch, which writes the setting", async () => {
    setAskiPlans(true);
    using _restore = { [Symbol.dispose]: () => setAskiPlans(true) };
    await using screen = await render(
      <>
        <ChatMarkdown
          cwd={undefined}
          text="Turn off [Aski divides the work](t3-context://v1/stemcells-setting/aski-plans) to keep your words as they are."
        />
        <Plans />
      </>,
    );
    const toggle = screen.getByRole("switch", { name: "Aski divides the work" });
    await expect.element(toggle).toBeChecked();
    await userEvent.click(toggle);
    await expect.element(screen.getByRole("status")).toHaveTextContent("off");
    await expect.element(toggle).not.toBeChecked();
  });

  it("draws upstream's setting as Settings' own switch", async () => {
    await using screen = await render(
      <ChatMarkdown
        cwd={undefined}
        text="[Auto-settle merged threads](t3-context://v1/stemcells-setting/auto-settle-merged)"
      />,
    );
    await expect
      .element(screen.getByRole("switch", { name: "Auto-settle merged threads" }))
      .toBeVisible();
  });

  it("draws another Cell a chat names as its token, which opens it beside", async () => {
    const chat = { environmentId: "env", threadId: "thread-o" } as unknown as ScopedThreadRef;
    await using screen = await render(
      <ChatMarkdown
        cwd={undefined}
        threadRef={chat}
        text="Manatee is hiding the third; `Manatee` is the module."
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Manatee" }));
    expect(beside).toHaveBeenCalledWith({
      environmentId: "env",
      threadId: "thread-m",
      draftId: null,
    });
    await expect.element(screen.getByText("Manatee", { exact: true }).nth(1)).toBeVisible();
    expect(screen.container.querySelectorAll("[data-stemcells-cell-token]")).toHaveLength(1);
  });

  it("leaves any other context link as its words", async () => {
    await using screen = await render(
      <ChatMarkdown
        cwd={undefined}
        text="See [the old copy](t3-context://v1/file/f_1) and [a lost one](t3-context://v1/stemcells-setting/nothing-here)."
      />,
    );
    await expect.element(screen.getByText("the old copy")).toBeVisible();
    await expect.element(screen.getByText("a lost one")).toBeVisible();
    expect(screen.container.querySelector("[role='switch']")).toBeNull();
  });
});

const FENCE = [
  "```chart",
  "bar: Files that conflicted in each sync",
  "| Sync | Files |",
  "| --- | --- |",
  "| 21 Oct | 2 |",
  "| 26 Oct | 22 |",
  "| 29 Oct | <5 |",
  "```",
].join("\n");

describe("a chart fence in a reply", () => {
  it("draws once it has closed, and says the same numbers as a table", async () => {
    await using screen = await render(
      <ChatMarkdown
        cwd={undefined}
        text={`Two syncs:\n\n${FENCE}\n\nThe second was the large one.`}
      />,
    );
    const chart = screen.getByRole("figure", { name: "Files that conflicted in each sync" });
    await expect.element(chart).toBeVisible();
    await expect.element(chart.getByText("26 Oct")).toBeVisible();
    await expect.element(screen.getByText("The second was the large one.")).toBeVisible();
    await expect.element(chart.getByText("<5")).toBeVisible();
    expect(screen.container.querySelector("pre")).toBeNull();
    // Copied with the words round it, the chart is its fence again.
    window.getSelection()?.selectAllChildren(screen.container);
    expect(chatMarkdownClipboardPayload(window.getSelection()!)?.text).toContain(FENCE);
    await userEvent.click(chart.getByRole("button", { name: "Table" }));
    await expect.element(chart.getByRole("table")).toBeVisible();
    await expect.element(chart.getByRole("cell", { name: "22" })).toBeVisible();
  });

  it.each([
    ["still streaming", FENCE.slice(0, FENCE.lastIndexOf("\n")), true],
    ["closed, with a cell that isn't a number", FENCE.replace("| 2 |", "| n/a |"), false],
  ])("stays the fence as written: %s", async (_name, text, isStreaming) => {
    await using screen = await render(
      <ChatMarkdown cwd={undefined} text={text} isStreaming={isStreaming} />,
    );
    await expect.element(screen.getByText(/\| 26 Oct \| 22 \|/)).toBeVisible();
    expect(screen.container.querySelector("figure")).toBeNull();
  });
});

const CHAT = { environmentId: "env", threadId: "thread-o" } as unknown as ScopedThreadRef;
const AT = "2026-10-21T12:00:00.000Z";

/** An assistant's reply as upstream's timeline hands it to its row. */
const said = (id: string, runId: string, text: string, streaming = false) =>
  ({
    kind: "message",
    id,
    createdAt: AT,
    message: {
      id: MessageId.make(id),
      role: "assistant",
      text,
      runId: RunId.make(runId),
      streaming,
      createdAt: AT,
      updatedAt: AT,
    },
    showAssistantMeta: !streaming,
    showAssistantCopyButton: false,
    assistantCopyStreaming: streaming,
  }) as const;

/** What upstream's row reads of its timeline; the rest it never touches for a plain reply. */
function Timeline(props: { latestRunId: string; children: React.ReactNode }) {
  const shared = {
    threadRef: CHAT,
    citationRequest: null,
    listRef: { current: null },
    markdownCwd: undefined,
    skills: [],
    timestampFormat: "locale",
    activeThreadEnvironmentId: "env",
    onOpenTurnDiff: undefined,
    onForkFromRun: undefined,
    onUseArtifactTemplate: () => {},
    onRunShellCommand: undefined,
    onImageExpand: () => {},
  } as unknown as TimelineRowSharedState;
  const activity = { latestRunId: props.latestRunId } as unknown as TimelineRowActivityState;
  return (
    <TimelineRowCtx value={shared}>
      <TimelineRowActivityCtx value={activity}>{props.children}</TimelineRowActivityCtx>
    </TimelineRowCtx>
  );
}

const LEFT = [
  "Both fixes are in.",
  "",
  "**Left:**",
  "- **you:** sign in at [the registry](https://example.com/login)",
  "- waiting: the checks on #212",
  "- me: merge it once they pass",
  "",
  "I can also tidy the old flags.",
].join("\n");

describe("a close-out in a reply", () => {
  it("draws as a card through upstream's row, and copies as the Cell wrote it", async () => {
    needs.cells = null;
    await using screen = await render(
      <Timeline latestRunId="run-9">
        <AssistantTimelineRow row={said("m-1", "run-1", LEFT)} />
      </Timeline>,
    );
    const card = screen.getByRole("group", { name: "Left" });
    await expect.element(card).toBeVisible();
    await expect.element(card.getByText("you", { exact: true })).toBeVisible();
    await expect.element(card.getByRole("link", { name: "the registry" })).toBeVisible();
    await expect.element(card.getByText("merge it once they pass")).toBeVisible();
    // Nothing of the reply is lost: its words before, and the offer after.
    await expect.element(screen.getByText("Both fixes are in.")).toBeVisible();
    await expect.element(screen.getByText("I can also tidy the old flags.")).toBeVisible();
    // An older run's reply: no word from the server stands under it.
    expect(screen.container.querySelector(`[aria-label="${RUN_SHOWS}"]`)).toBeNull();
    window.getSelection()?.selectAllChildren(screen.container);
    const copied = chatMarkdownClipboardPayload(window.getSelection()!)?.text ?? "";
    expect(copied).toContain("**Left:**\n- **you:** sign in at [the registry]");
    expect(copied).toContain("- me: merge it once they pass");
  });

  it("shows what the run shows under the Cell's latest reply alone", async () => {
    needs.cells = [
      {
        threadId: "thread-o",
        projectId: "project-1",
        title: "Header tokens",
        stage: "done",
        line: "the header fix",
        createdAt: AT,
        landing: { verdict: "shown", proof: "checks-clean" },
        brief: {
          goal: null,
          changed: null,
          checks: [{ kind: "test", ok: true }],
          pullRequest: null,
        },
      } satisfies CellStanding,
    ];
    using _reset = { [Symbol.dispose]: () => void (needs.cells = null) };
    await using screen = await render(
      <Timeline latestRunId="run-2">
        <AssistantTimelineRow row={said("m-1", "run-1", "**Done:** the first pass")} />
        <AssistantTimelineRow row={said("m-2", "run-2", "**Done:** the header fix")} />
      </Timeline>,
    );
    await expect.element(screen.getByRole("group", { name: "Done" }).nth(1)).toBeVisible();
    const shown = screen.getByRole("group", { name: RUN_SHOWS });
    await expect.element(shown).toBeVisible();
    expect(shown.elements()).toHaveLength(1);
    await expect
      .element(screen.getByRole("group", { name: "Done" }).nth(1).getByRole("group"))
      .toBeVisible();
  });

  it("stays the reply's words while it streams", async () => {
    needs.cells = null;
    await using screen = await render(
      <Timeline latestRunId="run-1">
        <AssistantTimelineRow row={said("m-1", "run-1", "Pushed.\n\n**Done:** the fix", true)} />
      </Timeline>,
    );
    await expect.element(screen.getByText("Done:")).toBeVisible();
    expect(screen.container.querySelector("fieldset")).toBeNull();
  });
});
