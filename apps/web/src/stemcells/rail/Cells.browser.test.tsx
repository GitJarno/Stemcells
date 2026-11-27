import "../upstream/appStyles";
import "../tokens/stemcells.css";

import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import {
  clearPlannedRows,
  onPlannedRowOpened,
  type PlannedRow,
  setPlannedRows,
} from "../../../../../stemcells/aski/planned.ts";
import { APP_NAME } from "../brand/name";
import { needFixture, NOW, requestFixture } from "../needs/fixtures";
import type { CellStanding, Condition, Need } from "../needs/wire";
import { REST_SLOT, SLOTS } from "../tabs/proxy";
import { act, render } from "../upstream/testRender";
import type { DesktopUpdateState } from "../upstream/updates";
import { useProviderRun, type ProviderOffer } from "../updates/providers";
import { useUpdateWanted } from "../updates/wanted";
import { Cells } from "./Cells";
import { useColumnStore } from "./column";
import { UpdateDriver } from "./UpdateBanner";

const spies = vi.hoisted(() => ({
  settle: vi.fn(),
  wake: vi.fn(),
  open: vi.fn(),
  download: vi.fn(async () => true),
  install: vi.fn(async () => true),
  openLink: vi.fn(),
  newCellPane: vi.fn(() => true),
  updateProviders: vi.fn(async () => [{ key: "mac:codex", failure: null }]),
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
/** The app's update as the desktop reports it; each test sets it in `setup`. */
const desktop = vi.hoisted(() => ({
  update: null as DesktopUpdateState | null,
  providers: [] as ReadonlyArray<ProviderOffer>,
}));

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

/** When the person last brought each Cell forward: Awake's order where a row shows no time. */
const launches = new Map(
  (
    [
      ["thread-a", "10:00"],
      ["thread-b", "10:01"],
      ["thread-w", "10:05"],
      ["thread-l1", "10:02"],
      ["thread-l2", "10:08"],
    ] as const
  ).map(([id, at]) => [id, { id, createdAt: `2026-10-26T${at}:00.000Z`, latestRun: null }]),
);

let stream:
  | { needs: Need[]; cells: CellStanding[]; conditions?: Condition[]; live: boolean }
  | undefined;
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
    asleep: [
      {
        environmentId: "env",
        threadId: "thread-z",
        projectId: "project-shop",
        title: "Nightly report",
        since: "2026-10-26T09:00:00.000Z",
        wakesAt: "2026-10-26T15:00:00.000Z",
      },
      {
        environmentId: "env",
        threadId: "thread-s",
        projectId: "project-shop",
        title: "Bump dependencies",
        since: "2026-10-25T09:00:00.000Z",
        wakesAt: null,
      },
    ],
    pinned: [
      { environmentId: "env", threadId: "thread-l1", projectId: "project-shop", title: "Chat l1" },
      { environmentId: "env", threadId: "thread-p", projectId: "project-harbor", title: "Roadmap" },
    ],
    launches,
  }),
  // Harbor's older settled Cells, which the server keeps back.
  useSettledKeptBack: (shown: (projectId: string) => boolean) => (shown("project-harbor") ? 40 : 0),
  useOpenCell: () => spies.open,
}));

vi.mock("../upstream/settle", () => ({
  useSettleCell: () => spies.settle,
  useWakeCell: () => spies.wake,
}));
vi.mock("../upstream/thread", () => ({
  useCellPlace: () => ({ name: "shop", isProject: true }),
  useCellTitle: () => null,
}));
vi.mock("../tabs/CellMark", () => ({ CellMark: () => <span data-testid="sprite" /> }));
// A row's parts read upstream's thread store; here each says a fixed age and project, and the
// Cells are Claude's, the last to land not yet opened.
vi.mock("../upstream/cellRow", async () => {
  const { cloneElement } = await import("react");
  return {
    useCellShell: (cell: { threadId: string }) => ({ id: cell.threadId }),
    useCellLightFacts: (cell: { threadId: string }) => ({
      driver: "claudeAgent",
      unseen: cell.threadId === "thread-l2",
    }),
    CellAge: () => "5m",
    compactAge: () => "12m",
    wakeIn: () => "3h",
    CellProjectMark: () => <span data-cells-row-project="">shop</span>,
    CellProjectMarkOf: () => <span data-cells-row-project="">shop</span>,
    CellCard: (props: { trigger: ReactElement; children: ReactNode }) =>
      cloneElement(props.trigger, undefined, props.children),
  };
});
vi.mock("../project/ProjectMark", () => ({ ProjectMark: () => null }));
vi.mock("../upstream/rail", () => ({
  isElectron: false,
  openSearch: () => undefined,
  openAddProject: () => undefined,
  SidebarUpdatePill: () => <li data-testid="upstream-update-pill" />,
  useShortcutLabel: () => "⌘K",
  useRailProjects: () => [
    {
      key: "harbor",
      name: "Harbor",
      record: {},
      memberKeys: ["env:project-harbor"],
      scope: { id: "project-harbor" },
    },
    {
      key: "shop",
      name: "Shop",
      record: {},
      memberKeys: ["env:project-shop"],
      scope: { id: "project-shop" },
    },
  ],
}));
vi.mock("../tabs/commands", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../tabs/commands")>()),
  openNewCellPane: spies.newCellPane,
}));
vi.mock("../upstream/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../upstream/settings")>()),
  useNavigateToMainApp: () => async () => undefined,
}));
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
  useProviderOffers: () => desktop.providers,
  useUpdateProviders: () => spies.updateProviders,
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

/** A row of Aski's plan, as the plan tray sets it. */
const planned = (
  threadId: string,
  tier: PlannedRow["tier"],
  unsure?: PlannedRow["unsure"],
): PlannedRow => ({
  threadId,
  projectId: "project-shop",
  projectName: "Shop",
  title: "Rework the film page",
  modelName: "Fable 5.2",
  effort: "high",
  tier,
  ...(unsure === undefined ? {} : { unsure }),
  born: NOW,
});

function setup(update: DesktopUpdateState | null, providers: ReadonlyArray<ProviderOffer> = []) {
  desktop.update = update;
  desktop.providers = providers;
  useColumnStore.setState({ project: null, stage: "awake" });
  useUpdateWanted.setState({ wanted: false });
  useProviderRun.setState({ started: [], failures: {} });
  spies.download.mockClear();
  spies.install.mockClear();
  spies.openLink.mockClear();
  spies.updateProviders.mockClear();
  spies.newCellPane.mockClear();
}

const codex: ProviderOffer = {
  key: "mac:codex",
  name: "Codex",
  machine: null,
  from: "0.164.0",
  to: "0.166.0",
  updating: false,
  failure: null,
};

function Column() {
  return (
    <div style={{ display: "flex", width: 288, height: 640 }}>
      <Cells />
    </div>
  );
}

describe("the Cells' column", () => {
  it("opens on every Cell awake, pins first then by the time each row shows, each lit by its state", async () => {
    setup(null);
    await using screen = await render(<Column />);
    await expect
      .element(screen.getByRole("button", { name: /Awake\s*5/ }))
      .toHaveAttribute("aria-pressed", "true");
    const awake = screen.getByRole("list", { name: "Awake" });
    await expect.element(awake.getByText("Chat thread-w")).toBeInViewport();
    await expect.element(awake.getByText("5m").first()).toBeVisible();
    await expect.element(awake.getByText("shop").first()).toBeVisible();
    // The asks are answered in their chats: only an asking Cell's light says so.
    await expect
      .element(screen.getByText("Delete the 214 original PNGs once the WebP copies are in?"))
      .not.toBeInTheDocument();
    const rows = [...awake.element().querySelectorAll<HTMLElement>("[data-cells-row]")];
    expect(rows.map((row) => row.dataset.cellsThread)).toEqual([
      "thread-l1",
      "thread-l2",
      "thread-w",
      // Asking since the same minute: a tie stands by id.
      "thread-a",
      "thread-b",
    ]);
    const light = (id: string) => {
      const plate = awake
        .element()
        .querySelector<HTMLElement>(`[data-cells-thread="${id}"] [data-cells-open]`)!;
      return [
        plate.dataset.light,
        plate.style.getPropertyValue("--cells-row-tone"),
        plate.querySelector("[data-cells-row-status]")?.getAttribute("aria-label") ?? null,
      ];
    };
    // The light stays the provider's; the icon says what the Cell does or needs.
    expect(light("thread-w")).toEqual(["flying", "var(--sc-provider-claude)", "Flying"]);
    expect(light("thread-a")).toEqual(["needs", "var(--sc-provider-claude)", "Input"]);
    expect(light("thread-l2")).toEqual(["news", "var(--sc-provider-claude)", "Landed"]);
    expect(light("thread-l1")).toEqual(["seen", "var(--sc-provider-claude)", null]);
    // Only a flying Cell's band crosses.
    await vi.waitFor(() =>
      expect(
        awake
          .element()
          .querySelector("[data-cells-thread='thread-w'] [data-cells-band]")
          ?.getAnimations().length,
      ).toBe(1),
    );
    expect(
      awake
        .element()
        .querySelector("[data-cells-thread='thread-l2'] [data-cells-band]")
        ?.getAnimations().length,
    ).toBe(0);
  });

  it("shows the Cells asleep, the latest first, a timed one by when it wakes", async () => {
    setup(null);
    await using screen = await render(<Column />);
    await userEvent.click(screen.getByRole("button", { name: /Asleep\s*42/ }));
    const asleep = screen.getByRole("list", { name: "Asleep" });
    await expect.element(asleep.getByText("Nightly report")).toBeVisible();
    await expect.element(asleep.getByText("Wakes in 3h")).toBeVisible();
    await expect.element(asleep.getByText("Bump dependencies")).toBeVisible();
    await expect.element(screen.getByText("40 more · search finds them")).toBeVisible();
  });

  it("sleeps an awake Cell from its row, folding it away at once, and wakes an asleep one", async () => {
    setup(null);
    spies.open.mockClear();
    // Each sleep runs until the test says how it ended.
    const sleeping: Array<(slept: boolean) => void> = [];
    spies.settle
      .mockReset()
      .mockImplementation(() => new Promise<boolean>((resolve) => sleeping.push(resolve)));
    spies.wake.mockReset().mockResolvedValue(true);
    await using screen = await render(<Column />);
    await userEvent.click(screen.getByRole("button", { name: /Awake\s*5/ }));
    const awake = screen.getByRole("list", { name: "Awake" });
    await userEvent.hover(awake.getByText("Chat thread-l1"));
    await userEvent.click(awake.getByRole("button", { name: "Sleep", exact: true }).first());
    expect(spies.settle).toHaveBeenCalledWith({ environmentId: "env", threadId: "thread-l1" });
    // Sleeping isn't opening: the row's own click stays put.
    expect(spies.open).not.toHaveBeenCalled();
    await expect.element(screen.getByRole("button", { name: /Awake\s*4/ })).toBeVisible();
    await vi.waitFor(() =>
      expect(document.querySelector('[data-cells-thread="thread-l1"]')?.clientHeight).toBe(0),
    );

    // A sleep that fails puts its Cell back.
    await act(async () => {
      for (const end of sleeping.splice(0)) end(false);
    });
    await expect.element(screen.getByRole("button", { name: /Awake\s*5/ })).toBeVisible();
    await expect.element(awake.getByText("Chat thread-l1")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: /Asleep\s*42/ }));
    const asleep = screen.getByRole("list", { name: "Asleep" });
    await userEvent.hover(asleep.getByText("Nightly report"));
    await userEvent.click(asleep.getByRole("button", { name: "Wake", exact: true }).first());
    // A timed sleep wakes with upstream's unsnooze.
    expect(spies.wake).toHaveBeenCalledWith({ environmentId: "env", threadId: "thread-z" }, true);
  });

  it("opens a Cell's chat from its row", async () => {
    setup(null);
    spies.open.mockClear();
    await using screen = await render(<Column />);
    await userEvent.click(screen.getByRole("button", { name: /Asleep\s*42/ }));
    await userEvent.click(screen.getByText("Bump dependencies"));
    expect(spies.open).toHaveBeenCalledWith({ environmentId: "env", threadId: "thread-s" });
  });
});

/**
 * Two fingers swipe the column a stage on (1) or back (-1) once it rests: a wheel event says the
 * fingers are on it, and its proxy lands a slot that way (`tabs/proxy.ts`).
 */
async function swipe(column: HTMLElement, way: 1 | -1) {
  await vi.waitFor(() => expect(column.hasAttribute("data-moving")).toBe(false), { timeout: 3000 });
  const slot = column.scrollWidth / SLOTS;
  column.dispatchEvent(new WheelEvent("wheel", { deltaX: way * 30, bubbles: true }));
  column.scrollTo({ left: (REST_SLOT + way) * slot, behavior: "instant" });
}

describe("the column's project filter", () => {
  it("shows one project's Cells; New Cell starts there", async () => {
    setup(null);
    await using screen = await render(<Column />);
    await userEvent.click(screen.getByRole("button", { name: "All projects" }));
    // The menu opens in a portal, outside the column.
    await userEvent.click(page.getByRole("menuitemradio", { name: "Shop" }));

    await expect.element(screen.getByRole("button", { name: /Awake\s*5/ })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: /Asleep\s*2/ })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "New Cell" }));
    expect(spies.newCellPane).toHaveBeenLastCalledWith({ id: "project-shop" });

    await userEvent.click(screen.getByRole("button", { name: "Shop" }));
    await userEvent.click(page.getByRole("menuitemradio", { name: "All projects" }));
    await expect.element(screen.getByRole("button", { name: "All projects" })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: /Asleep\s*42/ })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "New Cell" }));
    expect(spies.newCellPane).toHaveBeenLastCalledWith(null);
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
    const stage = screen.getByRole("button", { name: /Awake\s*5/ }).element();
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
    const open = (name: RegExp) =>
      expect.element(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "true");

    await open(/Awake\s*5/);
    await swipe(column, 1);
    await open(/Asleep\s*42/);
    await expect.element(screen.getByText("Nightly report")).toBeInViewport();
    await swipe(column, -1);
    await open(/Awake\s*5/);
    await swipe(column, -1);
    await open(/^Input\s*\d+$/);

    // Past the first stage the column gives a little, and comes back.
    await swipe(column, -1);
    await open(/^Input\s*\d+$/);
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
    await using stack = new AsyncDisposableStack();
    const before = streamState();
    stack.defer(() => {
      stream = before;
    });
    // A Cell a usage limit holds runs nothing a restart could stop: it isn't waited for.
    const held = { ...standing("thread-h", "working", ""), holds: "limit:claude:unknown" };
    stream = { ...before, cells: [...before.cells, held] };
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

  it("says a provider's update the same way, in place of upstream's pill", async () => {
    setup(upToDate, [codex]);
    await using screen = await render(<Column />);
    await expect
      .element(screen.getByRole("button", { name: "Codex gets better, 1 change" }))
      .toBeVisible();
    await expect.element(screen.getByTestId("upstream-update-pill")).not.toBeInTheDocument();
    await userEvent.hover(screen.getByRole("button", { name: /gets better/ }));
    await expect.element(page.getByText("0.164.0 → 0.166.0")).toBeVisible();
  });

  it("takes the providers and the app on one click, the providers at once", async () => {
    setup(available, [codex]);
    await using screen = await render(
      <>
        <UpdateDriver />
        <Column />
      </>,
    );
    await userEvent.hover(
      screen.getByRole("button", { name: `${APP_NAME} and Codex get better, 6 changes` }),
    );
    await userEvent.click(page.getByRole("button", { name: "Update" }));
    expect(spies.updateProviders).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(spies.download).toHaveBeenCalledOnce());
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
  /** The stream with each listed Cell at `stage`, and the asks of those that stopped asking gone. */
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

  it("counts a Cell a usage limit holds in Awake, in its place, under a head saying what holds it", async () => {
    setup(null);
    await using screen = await render(<Column />);
    await using stack = new AsyncDisposableStack();
    const before = streamState();
    stack.defer(() => {
      stream = before;
      useColumnStore.setState({ stage: "awake" });
    });
    const key = "limit:claude:unknown";
    const since = "2026-10-26T10:00:00.000Z";
    await act(() => {
      stream = {
        ...before,
        cells: before.cells.map((cell) =>
          cell.threadId === "thread-w" ? { ...cell, holds: key } : cell,
        ),
        conditions: [
          {
            key,
            kind: "limit",
            providerInstanceId: "claude",
            resetAt: null,
            since,
            waits: "you",
            cells: [
              {
                threadId: "thread-w",
                projectId: "project-shop",
                title: "Chat thread-w",
                runId: "run-w",
                since,
                carriesOn: false,
              },
            ],
          },
        ],
      };
      changes.tell();
    });
    await expect
      .element(screen.getByRole("button", { name: /Awake\s*1 holding\s*5/ }))
      .toBeVisible();
    await expect.element(screen.getByText("no reset stated")).toBeVisible();
    const awake = screen.getByRole("list", { name: "Awake" });
    await expect.element(awake.getByText("Chat thread-w")).toBeInViewport();
    // Held, it isn't flying: no band, a resting light.
    expect(
      awake.element().querySelector<HTMLElement>('[data-cells-thread="thread-w"] [data-cells-open]')
        ?.dataset.light,
    ).toBe("seen");
  });

  it("moves no row when a Cell lands or asks: only its light changes", async () => {
    setup(null);
    await using screen = await render(<Column />);
    await using stack = new AsyncDisposableStack();
    const before = streamState();
    stack.defer(() => {
      stream = before;
      useColumnStore.setState({ stage: "awake" });
    });
    const order = () =>
      [...document.querySelectorAll<HTMLElement>('[aria-label="Awake"] [data-cells-row]')].map(
        (row) => row.dataset.cellsThread,
      );
    await expect.element(screen.getByRole("button", { name: /Awake\s*5/ })).toBeVisible();
    const was = order();
    await act(() => {
      stream = moved(before, { "thread-w": "done", "thread-l2": "needs-you" });
      changes.tell();
    });
    await vi.waitFor(() =>
      expect(
        document.querySelector<HTMLElement>('[data-cells-thread="thread-w"] [data-cells-open]')
          ?.dataset.light,
      ).toBe("seen"),
    );
    expect(order()).toEqual(was);
    expect(document.querySelector("[data-cells-hop]")).toBeNull();
  });

  it("stands a planned row under the pin, and the machine's row takes it over in place", async () => {
    setup(null);
    await using screen = await render(<Column />);
    await using stack = new AsyncDisposableStack();
    const before = streamState();
    stack.defer(() => {
      stream = before;
      clearPlannedRows("plan");
    });
    const rows = () => [
      ...document.querySelectorAll<HTMLElement>('[aria-label="Awake"] [data-cells-row]'),
    ];
    await expect.element(screen.getByRole("button", { name: /Awake\s*5/ })).toBeVisible();
    await act(() => setPlannedRows("plan", [planned("thread-new", "start")]));
    await vi.waitFor(() =>
      expect(
        rows()
          .slice(0, 2)
          .map((row) => row.dataset.cellsThread),
      ).toEqual(["thread-l1", "thread-new"]),
    );
    const row = rows()[1]!;
    expect(row.dataset.born).toBe("");
    expect(row.textContent).toContain("Fable 5.2 · high");
    expect(row.querySelector("[data-cells-act]")).toBeNull();
    // The plan's Cell is not one of the machine's yet: Awake counts what it lists.
    await expect.element(screen.getByRole("button", { name: /Awake\s*5/ })).toBeVisible();

    await act(() => {
      stream = { ...before, cells: [...before.cells, standing("thread-new", "working", "")] };
      changes.tell();
    });
    await vi.waitFor(() =>
      expect(row.querySelector<HTMLElement>("[data-cells-open]")?.dataset.light).toBe("flying"),
    );
    expect(rows()[1]).toBe(row);
    expect(row.isConnected).toBe(true);
    expect(row.dataset.born).toBe("");
    expect(rows().filter((each) => each.dataset.cellsThread === "thread-new")).toHaveLength(1);
    expect(row.querySelector("[data-cells-act]")).not.toBeNull();
  });

  it("draws a Cell that waits for the person's check as an outline that leads to Aski's plan", async () => {
    setup(null);
    await using screen = await render(<Column />);
    await using stack = new AsyncDisposableStack();
    const opened: string[] = [];
    stack.defer(onPlannedRowOpened((row) => opened.push(row.threadId)));
    stack.defer(() => clearPlannedRows("plan"));
    await act(() => setPlannedRows("plan", [planned("thread-check", "check", "model")]));
    const row = screen.getByRole("listitem").filter({ hasText: "Rework the film page" });
    await expect.element(row).toHaveAttribute("data-outline", "");
    await expect.element(row.getByRole("img", { name: "Check the model" })).toBeVisible();
    spies.open.mockClear();
    await row.getByRole("button").click();
    expect(opened).toEqual(["thread-check"]);
    // Its own chat doesn't exist yet: nothing opens it.
    expect(spies.open).not.toHaveBeenCalledWith(
      expect.objectContaining({ threadId: "thread-check" }),
    );
  });

  it("hops a Cell the person woke into Awake's count, and is gone once it lands", async () => {
    setup(null);
    spies.wake.mockReset().mockResolvedValue(true);
    useColumnStore.setState({ stage: "asleep" });
    await using screen = await render(<Column />);
    await using stack = new AsyncDisposableStack();
    const before = streamState();
    stack.defer(() => {
      stream = before;
    });
    const asleep = screen.getByRole("list", { name: "Asleep" });
    await userEvent.hover(asleep.getByText("Nightly report"));
    await userEvent.click(asleep.getByRole("button", { name: "Wake", exact: true }).first());
    await act(() => {
      stream = { ...before, cells: [...before.cells, standing("thread-z", "working", "")] };
      changes.tell();
    });
    await expect.element(screen.getByRole("button", { name: /Awake\s*6/ })).toBeVisible();
    await vi.waitFor(() => expect(document.querySelector("[data-cells-hop]")).not.toBeNull());
    await vi.waitFor(() => expect(document.querySelector("[data-cells-hop]")).toBeNull());
  });
});
