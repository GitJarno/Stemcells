import "../upstream/appStyles";
import "../tokens/stemcells.css";

import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import { needFixture, NOW, requestFixture } from "../needs/fixtures";
import type { CellStanding, Need } from "../needs/wire";
import { render } from "../upstream/testRender";
import { Cells } from "./Cells";

const spies = vi.hoisted(() => ({ settle: vi.fn(), open: vi.fn(), openChat: vi.fn() }));

const needs: Need[] = [
  needFixture({
    key: "thread-a:request:1",
    threadId: "thread-a",
    title: "Move the images to WebP",
    kind: "question",
    request: requestFixture({
      id: "1",
      kind: "user_input",
      prompt: null,
      questions: [
        {
          id: "q",
          header: "Originals",
          question: "Delete the 214 original PNGs once the WebP copies are in?",
          options: [
            { label: "Keep them", description: "Nothing is lost.", value: null },
            { label: "Delete them", description: "The repo shrinks by 40 MB.", value: null },
          ],
          multiSelect: false,
          allowCustomAnswer: true,
        },
      ],
    }),
  }),
  needFixture({
    key: "thread-b:request:2",
    number: 2,
    threadId: "thread-b",
    title: "Hero images",
    kind: "question",
    request: requestFixture({
      id: "2",
      kind: "user_input",
      prompt: null,
      questions: [
        {
          id: "q",
          header: "Format",
          question: "Which format for the hero images?",
          options: [
            { label: "WebP", description: "Every browser shows it.", value: null },
            { label: "AVIF", description: "A third smaller.", value: null },
          ],
          multiSelect: false,
          allowCustomAnswer: true,
        },
      ],
    }),
  }),
];

const standing = (threadId: string, stage: CellStanding["stage"], line: string): CellStanding => ({
  threadId,
  projectId: "project-shop",
  title: `Chat ${threadId}`,
  stage,
  line,
  createdAt: "2026-10-26T10:00:00.000Z",
});

const cells: CellStanding[] = [
  standing("thread-a", "needs-you", ""),
  standing("thread-b", "needs-you", ""),
  standing("thread-w", "working", "Running benchmarks, 3 of 5"),
  standing("thread-l1", "done", "Done: #312 merged"),
  standing("thread-l2", "done", "Done: #309 merged"),
];

let stream: { needs: Need[]; cells: CellStanding[]; live: boolean } | undefined;
/** The stream's one list, made on first read: the mock's factory runs before this file's constants. */
function streamState() {
  stream ??= { needs, cells, live: true };
  return stream;
}

vi.mock("../needs/stream", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../needs/stream")>()),
  readNeeds: () => streamState(),
  subscribeNeeds: () => () => undefined,
  useNeeds: () => streamState(),
}));

vi.mock("../upstream/needs", () => ({
  COMPOSER_SURFACE_SELECTOR: '[data-chat-composer-surface="true"]',
  usePrimaryEnvironmentId: () => "env",
  useNowMinuteMs: () => NOW,
  useOpenFromNeeds: () => ({ chat: spies.openChat, providerSetup: () => undefined }),
  useDraftText: () => "",
  observeResize: () => () => undefined,
  openPrimaryStream: () => new Promise(() => undefined),
  sendThreadCommand: async () => ({ ok: true }),
}));

vi.mock("../upstream/column", () => ({
  useShelves: () => ({
    settled: [{ environmentId: "env", threadId: "thread-s", title: "Bump dependencies" }],
    pinned: [{ environmentId: "env", threadId: "thread-p", title: "Roadmap" }],
  }),
  useOpenCell: () => spies.open,
}));

vi.mock("../upstream/settle", () => ({ useSettleCell: () => spies.settle }));
vi.mock("../upstream/thread", () => ({
  useCellPlace: () => ({ name: "shop", isProject: true }),
  useCellTitle: () => null,
}));
vi.mock("../tabs/CellMark", () => ({ CellMark: () => <span data-testid="sprite" /> }));
vi.mock("../upstream/rail", () => ({
  isElectron: false,
  openSearch: () => undefined,
  SidebarUpdatePill: () => null,
  useShortcutLabel: () => "⌘K",
}));
vi.mock("../upstream/settings", () => ({ useNavigateToMainApp: () => async () => undefined }));
vi.mock("../upstream/ui", () => ({
  cn: (...names: unknown[]) => names.filter(Boolean).join(" "),
  useSidebar: () => ({ open: true, isMobile: false }),
  Tooltip: (props: { children: ReactNode }) => props.children,
  TooltipTrigger: (props: { render: ReactElement }) => props.render,
  TooltipPopup: () => null,
}));
vi.mock("./PlanRing", () => ({ PlanRing: () => null }));
vi.mock("./DiskGauge", () => ({ DiskGauge: () => null }));
vi.mock("./undoNotice", () => ({ useRailUndoNotice: () => undefined }));

function Column() {
  return (
    <div style={{ display: "flex", width: 288, height: 640 }}>
      <Cells />
    </div>
  );
}

describe("the Cells' column", () => {
  it("opens on what needs you: the question asked, counted in the row", async () => {
    await using screen = await render(<Column />);
    await expect
      .element(screen.getByText("Delete the 214 original PNGs once the WebP copies are in?"))
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: /Needs you\s*2/ }))
      .toHaveAttribute("aria-pressed", "true");
  });

  it("opens an asking Cell's chat from its card, not a peek only Aski's room shows", async () => {
    spies.openChat.mockClear();
    await using screen = await render(<Column />);
    await userEvent.click(screen.getByRole("button", { name: "Open chat" }));
    expect(spies.openChat).toHaveBeenCalledWith("thread-a");
  });

  it("opens one ask at a time, and answering it opens the next", async () => {
    await using screen = await render(<Column />);
    await expect.element(screen.getByRole("button", { name: /Keep them/ })).toBeVisible();
    await expect.element(screen.getByText("Which format for the hero images?")).toBeVisible();
    await expect.element(screen.getByRole("button", { name: /AVIF/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Keep them/ }));
    await expect.element(screen.getByRole("button", { name: /AVIF/ })).toBeVisible();

    // Taking the answer back opens its card again, and the next waits.
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await expect.element(screen.getByRole("button", { name: /Keep them/ })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: /AVIF/ })).not.toBeInTheDocument();
  });

  it("opens a waiting ask when it is clicked", async () => {
    await using screen = await render(<Column />);
    await userEvent.click(screen.getByText("Which format for the hero images?"));
    await expect.element(screen.getByRole("button", { name: /AVIF/ })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: /Keep them/ })).not.toBeInTheDocument();
  });

  it("opens the next ask as the keyboard steps onto it", async () => {
    await using screen = await render(<Column />);
    screen
      .getByRole("button", { name: /Keep them/ })
      .element()
      .focus();
    await userEvent.keyboard("{ArrowDown}");
    await expect.element(screen.getByRole("button", { name: /AVIF/ })).toBeVisible();
    // The focus went with it, so the next step or answer starts from there.
    expect(document.activeElement?.closest("[data-stemcells-need]")?.textContent).toContain(
      "Which format for the hero images?",
    );
  });

  it("shows a stage's Cells when its row is chosen, each with its own word", async () => {
    await using screen = await render(<Column />);
    await userEvent.click(screen.getByRole("button", { name: /Working\s*1/ }));
    await expect.element(screen.getByText("Running benchmarks, 3 of 5")).toBeVisible();
    await expect
      .element(screen.getByText("Delete the 214 original PNGs once the WebP copies are in?"))
      .not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Settled\s*1/ }));
    await expect.element(screen.getByText("Bump dependencies")).toBeVisible();
  });

  it("settles a landed Cell from its row, and all of them at once", async () => {
    spies.settle.mockClear();
    await using screen = await render(<Column />);
    await userEvent.click(screen.getByRole("button", { name: /Landed\s*2/ }));
    await userEvent.hover(screen.getByText("Done: #312 merged"));
    await userEvent.click(screen.getByRole("button", { name: "Settle", exact: true }).first());
    expect(spies.settle).toHaveBeenCalledWith({ environmentId: "env", threadId: "thread-l1" });
    await userEvent.click(screen.getByRole("button", { name: "Settle all" }));
    expect(spies.settle).toHaveBeenCalledTimes(3);
  });

  it("opens a Cell's chat from its row", async () => {
    spies.open.mockClear();
    await using screen = await render(<Column />);
    await userEvent.click(screen.getByRole("button", { name: /Pinned\s*1/ }));
    await userEvent.click(screen.getByText("Roadmap"));
    expect(spies.open).toHaveBeenCalledWith({ environmentId: "env", threadId: "thread-p" });
  });
});
