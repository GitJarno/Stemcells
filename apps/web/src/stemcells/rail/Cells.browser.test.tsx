import "../upstream/appStyles";
import "../tokens/stemcells.css";

import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { APP_NAME } from "../brand/name";
import { needFixture, NOW, requestFixture } from "../needs/fixtures";
import type { CellStanding, Need } from "../needs/wire";
import { act, render } from "../upstream/testRender";
import type { DesktopUpdateState } from "../upstream/updates";
import { useUpdateWanted } from "../updates/wanted";
import { Cells } from "./Cells";
import { useColumnStore } from "./column";
import { UpdateDriver } from "./UpdateBanner";

const spies = vi.hoisted(() => ({
  settle: vi.fn(),
  open: vi.fn(),
  openChat: vi.fn(),
  download: vi.fn(async () => true),
  install: vi.fn(async () => true),
  openLink: vi.fn(),
}));
/** Tells the column the stream changed, as the live stream does. */
const changes = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  let version = 0;
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    read: () => version,
    tell: () => {
      version += 1;
      for (const listener of listeners) listener();
    },
  };
});
/** Whether Aski's room is in front, its asks open on its right half. */
const room = vi.hoisted(() => ({ inFront: false }));
/** The app's update as the desktop reports it; each test sets it in `setup`. */
const desktop = vi.hoisted(() => ({ update: null as DesktopUpdateState | null }));

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

vi.mock("../needs/stream", async (importOriginal) => {
  const { useSyncExternalStore } = await import("react");
  return {
    ...(await importOriginal<typeof import("../needs/stream")>()),
    readNeeds: () => streamState(),
    subscribeNeeds: () => () => undefined,
    useNeeds: () => {
      useSyncExternalStore(changes.subscribe, changes.read);
      return streamState();
    },
  };
});

vi.mock("../upstream/needs", () => ({
  COMPOSER_SURFACE_SELECTOR: '[data-chat-composer-surface="true"]',
  usePrimaryEnvironmentId: () => "env",
  useNowMinuteMs: () => NOW,
  useOpenFromNeeds: () => ({ chat: spies.openChat, providerSetup: () => undefined }),
  useDraftText: () => "",
  observeResize: () => () => undefined,
  openPrimaryStream: () => new Promise(() => undefined),
  sendThreadCommand: async () => ({ ok: true }),
  unsnoozeCell: async () => ({ ok: true }),
  ChatMarkdown: (props: { text: string }) => props.text,
  cellRef: () => null,
  useRepositoryUrl: () => null,
}));

vi.mock("../upstream/column", () => ({
  useShelves: () => ({
    settled: [
      {
        environmentId: "env",
        threadId: "thread-s",
        projectId: "project-shop",
        title: "Bump dependencies",
      },
    ],
    pinned: [
      { environmentId: "env", threadId: "thread-p", projectId: "project-harbor", title: "Roadmap" },
    ],
  }),
  useOpenCell: () => spies.open,
}));

vi.mock("../aski/inFront", () => ({ useAskiRoomInFront: () => room.inFront }));
vi.mock("../upstream/settle", () => ({ useSettleCell: () => spies.settle }));
vi.mock("../upstream/thread", () => ({
  useCellPlace: () => ({ name: "shop", isProject: true }),
  useCellTitle: () => null,
}));
vi.mock("../tabs/CellMark", () => ({ CellMark: () => <span data-testid="sprite" /> }));
// A row's parts read upstream's thread store; here each says a fixed age and project.
vi.mock("../upstream/cellRow", async () => {
  const { cloneElement } = await import("react");
  return {
    useCellShell: (cell: { threadId: string }) => ({ id: cell.threadId }),
    CellAge: () => "5m",
    compactAge: () => "12m",
    CellProject: () => <span data-cells-row-project="">shop</span>,
    CellPullRequest: () => null,
    CellCard: (props: { trigger: ReactElement; children: ReactNode }) =>
      cloneElement(props.trigger, undefined, props.children),
  };
});
vi.mock("../upstream/rail", () => ({
  isElectron: false,
  openSearch: () => undefined,
  SidebarUpdatePill: () => <li data-testid="upstream-update-pill" />,
  useShortcutLabel: () => "⌘K",
  ProjectFavicon: () => null,
  useRailProjects: () => [
    { key: "harbor", name: "Harbor", record: {}, memberKeys: ["env:project-harbor"] },
    { key: "shop", name: "Shop", record: {}, memberKeys: ["env:project-shop"] },
  ],
}));
vi.mock("../upstream/settings", () => ({ useNavigateToMainApp: () => async () => undefined }));
vi.mock("../upstream/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../upstream/ui")>()),
  useSidebar: () => ({ open: true, isMobile: false }),
  Tooltip: (props: { children: ReactNode }) => props.children,
  TooltipTrigger: (props: { render: ReactElement }) => props.render,
  TooltipPopup: () => null,
}));
vi.mock("../upstream/updates", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../upstream/updates")>()),
  useDesktopUpdateState: () => desktop.update,
  downloadUpdate: spies.download,
  installUpdate: spies.install,
  openLink: spies.openLink,
  pullRequestUrl: (number: number) => `https://github.com/example/stemcells/pull/${number}`,
}));
vi.mock("./PlanRing", () => ({ PlanRing: () => null }));
vi.mock("./DiskPlate", () => ({ DiskPlate: () => null }));
vi.mock("./undoNotice", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./undoNotice")>()),
  useRailUndoNotice: () => undefined,
}));

const upToDate: DesktopUpdateState = {
  enabled: true,
  status: "up-to-date",
  channel: "nightly",
  currentVersion: "0.1.1-nightly.20261024.7266",
  hostArch: "arm64",
  appArch: "arm64",
  runningUnderArm64Translation: false,
  availableVersion: null,
  downloadedVersion: null,
  releaseNotes: [],
  omittedReleaseCount: 0,
  downloadPercent: null,
  checkedAt: "2026-10-26T10:00:00.000Z",
  message: null,
  errorContext: null,
  canRetry: false,
};

/** Two days of merges to main: five pull requests, three of them listed. */
const available: DesktopUpdateState = {
  ...upToDate,
  status: "available",
  availableVersion: "0.1.1-nightly.20261026.7271",
  releaseNotes: [
    {
      version: "0.1.1-nightly.20261026.7271",
      items: [
        "The phone's + opens Add to Chat (#300)",
        "The left column is the Cells' line (#302)",
      ],
      totalItems: 2,
    },
    {
      version: "0.1.1-nightly.20261025.7269",
      items: ["Aski stands in the phone's new chat (#299)"],
      totalItems: 3,
    },
  ],
};

function setup(update: DesktopUpdateState | null) {
  desktop.update = update;
  useColumnStore.setState({ project: null, stage: "needs" });
  useUpdateWanted.setState({ wanted: false });
  spies.download.mockClear();
  spies.install.mockClear();
  spies.openLink.mockClear();
}

function Column() {
  return (
    <div style={{ display: "flex", width: 288, height: 640 }}>
      <Cells />
    </div>
  );
}

/** Aski's room as the column finds it: each ask open, where a step onto it lands. */
function Room() {
  return (
    <div data-stemcells-needs-frame="">
      <div data-stemcells-needs-list="">
        {needs.map((need) => (
          <section
            key={need.key}
            data-stemcells-need=""
            data-open=""
            data-need-key={need.key}
            tabIndex={-1}
          >
            <button type="button" data-need-option="" data-recommended="">
              {`Answer ${need.threadId}`}
            </button>
          </section>
        ))}
      </div>
    </div>
  );
}

describe("the Cells' column", () => {
  it("opens on what needs you: the question asked, counted in the row", async () => {
    setup(null);
    await using screen = await render(<Column />);
    await expect
      .element(screen.getByText("Delete the 214 original PNGs once the WebP copies are in?"))
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: /Needs you\s*2/ }))
      .toHaveAttribute("aria-pressed", "true");
  });

  it("opens an asking Cell's chat from its card, not a peek only Aski's room shows", async () => {
    setup(null);
    spies.openChat.mockClear();
    await using screen = await render(<Column />);
    // Open chat stands in the age's place once the pointer is on the ask.
    await userEvent.hover(
      screen.getByText("Delete the 214 original PNGs once the WebP copies are in?"),
    );
    await userEvent.click(screen.getByRole("button", { name: "Open chat" }));
    expect(spies.openChat).toHaveBeenCalledWith("thread-a");
  });

  it("opens one ask at a time, and answering it opens the next", async () => {
    await using screen = await render(<Column />);
    await expect.element(screen.getByRole("button", { name: /Keep them/ })).toBeVisible();
    await expect.element(screen.getByText("Which format for the hero images?")).toBeVisible();
    await expect.element(screen.getByRole("button", { name: /AVIF/ })).not.toBeInTheDocument();

    // The answer folds its card away at once, onto the undo line.
    await userEvent.click(screen.getByRole("button", { name: /Keep them/ }));
    await expect.element(screen.getByRole("button", { name: /AVIF/ })).toBeVisible();
    // Folded to nothing, it stays in place only while Undo can bring it back.
    await vi.waitFor(() =>
      expect(document.querySelector('[data-need-thread="thread-a"]')?.clientHeight).toBe(0),
    );
    await expect.element(screen.getByText("Answered 1 Cell,")).toBeVisible();

    // Taking the answer back opens its card again, and the next waits.
    await userEvent.click(screen.getByRole("button", { name: /undo/i }));
    await expect.element(screen.getByRole("button", { name: /Keep them/ })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: /AVIF/ })).not.toBeInTheDocument();
  });

  it("opens a waiting ask when it is clicked", async () => {
    await using screen = await render(<Column />);
    await userEvent.click(screen.getByText("Which format for the hero images?"));
    await expect.element(screen.getByRole("button", { name: /AVIF/ })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: /Keep them/ })).not.toBeInTheDocument();
  });

  it("folds every ask to an index in front of Aski's room, and lands on one there when clicked", async () => {
    room.inFront = true;
    using _room = { [Symbol.dispose]: () => (room.inFront = false) };
    await using screen = await render(
      <>
        <Column />
        <Room />
      </>,
    );
    await expect
      .element(screen.getByText("Delete the 214 original PNGs once the WebP copies are in?"))
      .toBeVisible();
    await expect.element(screen.getByRole("button", { name: /Keep them/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("Which format for the hero images?"));
    expect(document.activeElement?.textContent).toBe("Answer thread-b");
    await expect.element(screen.getByRole("button", { name: /AVIF/ })).not.toBeInTheDocument();
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

  it("shows a stage's Cells when its row is chosen, each with its age and project", async () => {
    setup(null);
    await using screen = await render(<Column />);
    await userEvent.click(screen.getByRole("button", { name: /Flying\s*1/ }));
    const working = screen.getByRole("list", { name: "Flying" });
    await expect.element(working.getByText("Chat thread-w")).toBeInViewport();
    await expect.element(working.getByText("5m")).toBeVisible();
    await expect.element(working.getByText("shop")).toBeVisible();
    // What needs you slid off beside it, a swipe away.
    await expect
      .element(screen.getByText("Delete the 214 original PNGs once the WebP copies are in?"))
      .not.toBeInViewport();
    await userEvent.click(screen.getByRole("button", { name: /Settled\s*1/ }));
    await expect.element(screen.getByText("Bump dependencies")).toBeVisible();
  });

  it("settles a landed Cell from its row, and all of them, each off the line at once", async () => {
    setup(null);
    spies.open.mockClear();
    // Each settle runs until the test says how it ended.
    const settling: Array<(settled: boolean) => void> = [];
    spies.settle
      .mockReset()
      .mockImplementation(() => new Promise<boolean>((resolve) => settling.push(resolve)));
    const refuse = () =>
      act(async () => {
        for (const end of settling.splice(0)) end(false);
      });
    await using screen = await render(<Column />);
    await userEvent.click(screen.getByRole("button", { name: /Landed\s*2/ }));
    const landed = screen.getByRole("list", { name: "Landed" });
    await userEvent.hover(landed.getByText("Chat thread-l1"));
    await userEvent.click(landed.getByRole("button", { name: "Settle", exact: true }).first());
    expect(spies.settle).toHaveBeenCalledWith({ environmentId: "env", threadId: "thread-l1" });
    // Settling isn't opening: the row's own click stays put.
    expect(spies.open).not.toHaveBeenCalled();
    await expect.element(screen.getByText("Chat thread-l1")).not.toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: /Landed\s*1/ })).toBeVisible();

    // A settle that fails puts its Cell back.
    await refuse();
    await expect.element(screen.getByText("Chat thread-l1")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Settle all" }));
    expect(spies.settle).toHaveBeenCalledTimes(3);
    await expect.element(screen.getByText("Nothing waits to be settled.")).toBeVisible();
    await refuse();
  });

  it("opens a Cell's chat from its row", async () => {
    setup(null);
    spies.open.mockClear();
    await using screen = await render(<Column />);
    await userEvent.click(screen.getByRole("button", { name: /Pinned\s*1/ }));
    await userEvent.click(screen.getByText("Roadmap"));
    expect(spies.open).toHaveBeenCalledWith({ environmentId: "env", threadId: "thread-p" });
  });
});

/**
 * Two fingers touching down on the column once it rests, and moving `dx` (px, toward later
 * stages): a wheel event a frame, as a trackpad sends them, the first one short as a touch's is.
 */
async function swipe(column: HTMLElement, dx: number) {
  const pages = column.querySelector<HTMLElement>("[data-cells-pages]")!;
  const strip = column.querySelector<HTMLElement>("[data-cells-strip]")!;
  await vi.waitFor(() => expect(pages.hasAttribute("data-moving")).toBe(false), { timeout: 3000 });
  const first = Math.sign(dx) * 4;
  column.dispatchEvent(new WheelEvent("wheel", { deltaX: first, cancelable: true }));
  for (let i = 0; i < 9; i++) {
    const drawn = strip.style.transform;
    column.dispatchEvent(new WheelEvent("wheel", { deltaX: (dx - first) / 9, cancelable: true }));
    await vi.waitFor(() => expect(strip.style.transform).not.toBe(drawn), { interval: 1 });
  }
}

describe("the column's project filter", () => {
  it("shows one project's Cells, while Needs you counts every ask and says where they are", async () => {
    setup(null);
    await using screen = await render(<Column />);
    await userEvent.click(screen.getByRole("button", { name: "All projects" }));
    // The menu opens in a portal, outside the column.
    await userEvent.click(page.getByRole("menuitemradio", { name: "Shop" }));

    // Both asks are Harbor's.
    await expect.element(screen.getByText("Nothing in Shop needs you.")).toBeVisible();
    await expect
      .element(screen.getByText("Delete the 214 original PNGs once the WebP copies are in?"))
      .not.toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: /Needs you\s*2/ })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: /Flying\s*1/ })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: /Settled\s*1/ })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: /Pinned\s*0/ })).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Also 2 in Harbor" }));
    await expect
      .element(screen.getByText("Delete the 214 original PNGs once the WebP copies are in?"))
      .toBeVisible();
    await expect.element(screen.getByRole("button", { name: "All projects" })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: /Pinned\s*1/ })).toBeVisible();
  });
});

/** Settings › Interface size as upstream applies it (appearanceFonts.ts): the root's font size. */
function interfaceSize(px: number): Disposable {
  const root = document.documentElement;
  const before = root.style.fontSize;
  root.style.fontSize = `${px}px`;
  return { [Symbol.dispose]: () => void (root.style.fontSize = before) };
}

describe("the column at another interface size", () => {
  it("grows its plates, spaces and words together with the app's type", async () => {
    setup(null);
    await using screen = await render(<Column />);
    const search = screen.container.querySelector<HTMLElement>("[data-cells-search]")!;
    const stage = screen.getByRole("button", { name: /Needs you\s*2/ }).element();
    const measure = () => ({
      plate: search.getBoundingClientRect().height,
      inset: Number.parseFloat(getComputedStyle(search).paddingInlineStart),
      corner: Number.parseFloat(getComputedStyle(search).borderTopLeftRadius),
      row: stage.getBoundingClientRect().height,
      words: Number.parseFloat(getComputedStyle(stage).fontSize),
    });
    expect(measure()).toEqual({ plate: 32, inset: 8, corner: 12, row: 30, words: 14 });

    using _size = interfaceSize(20);
    expect(measure()).toEqual({ plate: 40, inset: 10, corner: 15, row: 37.5, words: 17.5 });
  });
});

describe("swiping the column", () => {
  it("turns its stages in the line's order, either way, and holds at the first", async () => {
    setup(null);
    await using screen = await render(<Column />);
    const column = screen.container.querySelector<HTMLElement>("[data-stemcells-cells]")!;
    await userEvent.click(screen.getByRole("button", { name: /Needs you\s*2/ }));
    const open = (name: RegExp) =>
      expect.element(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "true");

    await swipe(column, 300);
    await open(/Flying\s*1/);
    await expect.element(screen.getByText("Chat thread-w")).toBeInViewport();
    await swipe(column, 300);
    await open(/Landed\s*2/);
    await swipe(column, -300);
    await open(/Flying\s*1/);
    await swipe(column, -300);
    await open(/Needs you\s*2/);

    // Past the first stage the column gives a little, and springs back.
    await swipe(column, -300);
    await open(/Needs you\s*2/);
    await expect
      .element(screen.getByText("Delete the 214 original PNGs once the WebP copies are in?"))
      .toBeInViewport();
  });
});

describe("the column's word that Stemcells gets better", () => {
  it("says so with the pull requests the update brings, in place of upstream's pill", async () => {
    setup(available);
    await using screen = await render(<Column />);
    await expect
      .element(screen.getByRole("button", { name: `${APP_NAME} gets better, 5 changes` }))
      .toHaveTextContent(`${APP_NAME} gets better5`);
    await expect.element(screen.getByTestId("upstream-update-pill")).not.toBeInTheDocument();
  });

  it("lists what got better when hovered, each opening its pull request", async () => {
    setup(available);
    await using screen = await render(<Column />);
    await userEvent.hover(screen.getByRole("button", { name: /gets better/ }));
    // The list is a popup, outside the column.
    const change = page.getByRole("link", { name: "The left column is the Cells' line" });
    await expect.element(change).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: "Aski stands in the phone's new chat" }))
      .toBeVisible();
    await expect.element(page.getByText("and 2 more")).toBeVisible();
    await userEvent.click(change);
    expect(spies.openLink).toHaveBeenCalledWith("https://github.com/example/stemcells/pull/302");
  });

  it("updates on one click: it gets the update ready, without a step of its own", async () => {
    setup(available);
    await using screen = await render(
      <>
        <UpdateDriver />
        <Column />
      </>,
    );
    await userEvent.hover(screen.getByRole("button", { name: /gets better/ }));
    await userEvent.click(page.getByRole("button", { name: "Update" }));
    await vi.waitFor(() => expect(spies.download).toHaveBeenCalledOnce());
  });

  it("waits for Cells at work before it restarts, and says so, unless told to now", async () => {
    setup({ ...available, status: "downloaded", downloadedVersion: available.availableVersion });
    await using screen = await render(
      <>
        <UpdateDriver />
        <Column />
      </>,
    );
    await userEvent.hover(screen.getByRole("button", { name: /gets better/ }));
    await userEvent.click(page.getByRole("button", { name: "Update" }));
    // One Cell works and two hold their run on an ask: a restart would stop all three.
    await expect
      .element(screen.getByRole("button", { name: /Restarts once your Cells finish/ }))
      .toBeVisible();
    await expect
      .element(page.getByText("3 Cells are flying, and a restart would stop them."))
      .toBeVisible();
    expect(spies.install).not.toHaveBeenCalled();
    await userEvent.click(page.getByRole("button", { name: "Restart now" }));
    expect(spies.install).toHaveBeenCalledOnce();
  });

  it("is nowhere while the app is up to date, and the foot keeps upstream's pill", async () => {
    setup(upToDate);
    await using screen = await render(<Column />);
    await expect.element(screen.getByTestId("upstream-update-pill")).toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: /gets better/ }))
      .not.toBeInTheDocument();
  });
});

describe("a Cell moving along the line", () => {
  /** The stream with each listed Cell at `stage`, and the asks of those that left Needs you gone. */
  const moved = (
    before: ReturnType<typeof streamState>,
    to: Record<string, CellStanding["stage"]>,
  ) => ({
    ...before,
    needs: before.needs.filter((need) => to[need.threadId] === undefined),
    cells: before.cells.map((cell) =>
      to[cell.threadId] === undefined ? cell : { ...cell, stage: to[cell.threadId]! },
    ),
  });

  it("only changes the count when the person didn't move it", async () => {
    await using screen = await render(<Column />);
    await using stack = new AsyncDisposableStack();
    const before = streamState();
    stack.defer(() => {
      stream = before;
    });
    await expect.element(screen.getByRole("button", { name: /Landed\s*2/ })).toBeVisible();
    await act(() => {
      stream = moved(before, { "thread-w": "done" });
      changes.tell();
    });
    await expect.element(screen.getByRole("button", { name: /Landed\s*3/ })).toBeVisible();
    expect(document.querySelector("[data-cells-hop]")).toBeNull();
  });

  it("hops a Cell the person answered into its new stage's count, and is gone once it lands", async () => {
    await using screen = await render(<Column />);
    await using stack = new AsyncDisposableStack();
    const before = streamState();
    stack.defer(() => {
      stream = before;
    });
    await userEvent.click(screen.getByRole("button", { name: /Keep them/ }));
    await act(() => {
      stream = moved(before, { "thread-a": "working" });
      changes.tell();
    });
    await expect.element(screen.getByRole("button", { name: /Flying\s*2/ })).toBeVisible();
    await vi.waitFor(() => expect(document.querySelector("[data-cells-hop]")).not.toBeNull());
    await vi.waitFor(() => expect(document.querySelector("[data-cells-hop]")).toBeNull());
  });
});
