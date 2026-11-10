/**
 * Upstream's question panel, as the previews stand in it (stemcells/tasks/question-previews.md):
 * it hands our seam one row per option in the options' order, so the row pointed at or focused
 * is the option whose preview shows. A failure here after a sync names what moved.
 */
import "../../index.css";

import { EnvironmentId, RuntimeRequestId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

vi.mock(import("../../components/ChatMarkdown"), () => ({
  default: (({ text }: { text: string }) => <p>{text}</p>) as never,
}));

import { ComposerPendingUserInputPanel } from "../../components/chat/ComposerPendingUserInputPanel";
import { render } from "./testRender";

const lines = (count: number, word: string) =>
  Array.from({ length: count }, (_, line) => `${word} ${line + 1}`).join("\n");

const OPTIONS = [
  { label: "Short", description: "Three lines", preview: lines(3, "short") },
  { label: "Tall", description: "Past the cap", preview: lines(60, "tall") },
  { label: "Plain", description: "No preview" },
];

async function renderPanel(width: number, options: typeof OPTIONS) {
  const container = document.body.appendChild(document.createElement("div"));
  container.style.width = `${width}px`;
  return render(
    <ComposerPendingUserInputPanel
      pendingUserInputs={[
        {
          requestId: RuntimeRequestId.make("question-previews"),
          createdAt: "2026-11-10T00:00:00.000Z",
          dismissible: false,
          responseCapability: "live",
          questions: [
            { id: "layout", header: "Layout", question: "Which one?", multiSelect: false, options },
          ],
        },
      ]}
      cwd={undefined}
      threadRef={{ environmentId: EnvironmentId.make("env"), threadId: ThreadId.make("thread") }}
      respondingRequestIds={[]}
      answers={{}}
      questionIndex={0}
      onToggleOption={() => {}}
      onAdvance={() => {}}
      onDismiss={() => {}}
    />,
    { container },
  );
}

const box = (container: HTMLElement) =>
  container.querySelector<HTMLElement>("[data-option-preview]");
const shown = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-option-preview-pane="shown"]');

describe("a question's option previews, in upstream's panel", () => {
  it("draws no box for a question with no previews", async () => {
    await using screen = await renderPanel(
      720,
      OPTIONS.map(({ label, description }) => ({ label, description })),
    );
    await expect.element(screen.getByRole("button", { name: /Short/ })).toBeVisible();
    expect(box(screen.container)).toBeNull();
  });

  it("shows the option pointed at or focused, and never changes height for it", async () => {
    await using screen = await renderPanel(720, OPTIONS);
    const option = (name: RegExp) => screen.getByRole("button", { name });
    await expect.poll(() => shown(screen.container)?.textContent).toContain("short 3");
    const height = () => box(screen.container)!.getBoundingClientRect().height;
    const first = height();

    await userEvent.hover(option(/Tall/));
    await expect.poll(() => shown(screen.container)?.textContent).toContain("tall 60");
    // The tall one is capped and scrolls inside itself.
    const pane = shown(screen.container)!;
    expect(pane.scrollHeight).toBeGreaterThan(pane.clientHeight);
    expect(height()).toBe(first);

    (option(/Plain/).element() as HTMLElement).focus();
    await expect.poll(() => shown(screen.container)?.textContent).not.toContain("tall");
    expect(height()).toBe(first);
    // A box that hugged the short preview would be a few lines tall.
    expect(first).toBeGreaterThan(pane.clientHeight);
  });

  it("stands beside the options with room for both, and under them in a narrow pane", async () => {
    const places = async (width: number) => {
      await using screen = await renderPanel(width, OPTIONS);
      await expect.poll(() => box(screen.container)).not.toBeNull();
      const rows = screen.getByRole("button", { name: /Plain/ }).element().getBoundingClientRect();
      return { rows, box: box(screen.container)!.getBoundingClientRect() };
    };
    const wide = await places(720);
    expect(wide.box.left).toBeGreaterThanOrEqual(wide.rows.right);
    expect(wide.box.top).toBeLessThan(wide.rows.bottom);
    const narrow = await places(300);
    expect(narrow.box.top).toBeGreaterThanOrEqual(narrow.rows.bottom);
    expect(narrow.box.right).toBeLessThanOrEqual(300);
  });
});
