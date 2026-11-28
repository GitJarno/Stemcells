import "../../upstream/appStyles";
import "../../tokens/stemcells.css";

import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import {
  DICTATED_NOTE,
  type Plan,
  type StartAct,
} from "../../../../../../stemcells/orchestrator/plan.ts";
import { act, render } from "../../upstream/testRender";
import { PlanTray } from "./PlanTray";
import { PlanRoom } from "./room";
import { beginPlan, clearPlans, planOf, planRead } from "./store";

// The card and its rows as the person meets them. The runner is the real one with no hands, so
// Send, a switch and Cancel change the plan and start nothing; what a row reads of upstream is fixed.
vi.mock("./PlanRunner", async () => {
  const { createRunner } = await import("./run");
  return { runner: createRunner(() => null) };
});
vi.mock("../../upstream/askiPlans", () => ({
  useOwnWorktree: () => () => false,
  usePlanPlaces: () => ({
    places: [
      { id: "harbor", name: "Harbor" },
      { id: "atlas", name: "Atlas" },
    ],
  }),
  usePlanRows: () => ({
    projectOf: () => null,
    factsOf: () => ({ projectId: "", modelName: "Fable 5.2", effort: "high", driver: undefined }),
    modelOf: () => null,
  }),
}));
vi.mock("../../upstream/planPick", () => ({
  PlanModelPick: () => <button type="button">Fable 5.2 high</button>,
}));
vi.mock("../../needs/stream", () => ({ useNeeds: () => ({ cells: [], conditions: [] }) }));
vi.mock("../../upstream/needs", () => ({
  useNowMinuteMs: () => 0,
  useOpenFromNeeds: () => ({ chat: () => undefined }),
}));
vi.mock("../../upstream/cellRow", () => ({
  useCellShell: () => null,
  useCellLightFacts: () => ({ driver: null, unseen: false }),
  compactAge: () => "now",
  CellProjectMarkOf: () => null,
}));
vi.mock("../../tabs/CellMark", () => ({ CellMark: () => <span data-testid="creature" /> }));

const ASKI = { environmentId: "env", threadId: "aski", draftId: null };

const cell = (i: number, title: string, over: Partial<StartAct> = {}): StartAct => ({
  kind: "start",
  i,
  pieces: [i + 1],
  tier: "start",
  why: [],
  threadId: `thread-${i}`,
  title,
  words: `${title.toLowerCase()} in Harbor`,
  note: null,
  place: { id: "harbor", name: "Harbor", heard: "Harbor", how: "exact" },
  model: null,
  effort: null,
  risks: [],
  ...over,
});

const plan = (acts: Plan["acts"]): Plan => ({
  id: "plan",
  dictated: false,
  pieces: [],
  acts,
  talk: [],
  leftOver: [],
  from: "read",
});

/** The tray over Aski's composer with one plan just read; leaving, the window holds no plan. */
async function show(acts: Plan["acts"]) {
  const stack = new AsyncDisposableStack();
  stack.defer(() => clearPlans());
  stack.use(
    await render(
      <PlanRoom value={ASKI}>
        <div style={{ width: 720 }}>
          <PlanTray aski={ASKI} />
        </div>
      </PlanRoom>,
      { router: false },
    ),
  );
  await act(() => {
    beginPlan("plan", "env/aski", 1, "fix the importer");
    planRead("plan", plan(acts));
  });
  return stack;
}

const rowOf = (title: string) => page.getByRole("listitem").filter({ hasText: title });
const statuses = () => planOf("plan")?.tray?.acts.map((one) => one.status);

describe("a plan's card", () => {
  it("shows tasks, not Cells, until Send: switched off or on, opened to their exact words, then sent", async () => {
    await using _screen = await show([
      cell(0, "Fix the importer", { note: DICTATED_NOTE }),
      cell(1, "Write its changelog", { after: [0], afterHeard: "once that's done" }),
      cell(2, "Tidy the readme"),
    ]);
    // A task has no creature, and says what it comes after by the row above it.
    await expect.element(rowOf("Fix the importer")).toBeVisible();
    expect(document.querySelector('[data-testid="creature"]')).toBeNull();
    await expect
      .element(rowOf("Write its changelog").getByText("Then", { exact: true }))
      .toBeVisible();
    const send = page.getByRole("button", { name: /^Send 3/ });
    await expect.element(send).toBeEnabled();

    // Its chevron opens what the Cell is told, the line code adds included.
    await userEvent.click(
      rowOf("Fix the importer").getByRole("button", { name: "What it's told" }),
    );
    await expect
      .element(rowOf("Fix the importer").getByRole("button", { name: "What it's told" }))
      .toHaveAttribute("aria-expanded", "true");
    expect(document.querySelector("[data-plan-words]")?.textContent).toBe(
      `fix the importer in Harbor\n\n${DICTATED_NOTE}`,
    );

    // Off, the task is left out, and the one that came after it waits for no one.
    await userEvent.hover(page.getByText("Fix the importer", { exact: true }));
    await userEvent.click(rowOf("Fix the importer").getByRole("button", { name: "Off" }));
    await expect.element(rowOf("Fix the importer")).toHaveAttribute("data-off", "");
    await expect.element(page.getByRole("button", { name: /^Send 2/ })).toBeEnabled();
    await expect
      .element(rowOf("Write its changelog").getByText("Then", { exact: true }))
      .not.toBeInTheDocument();
    await userEvent.click(rowOf("Fix the importer").getByRole("button", { name: "On" }));
    // The switch is the row's own act: it shows, and takes a press, while the row is pointed at.
    await userEvent.hover(page.getByText("Tidy the readme", { exact: true }));
    await userEvent.click(rowOf("Tidy the readme").getByRole("button", { name: "Off" }));

    expect(statuses()).toEqual(["waiting", "waiting", "waiting"]);
    await userEvent.click(page.getByRole("button", { name: /^Send 2/ }));
    expect(statuses()).toEqual(["starting", "queued", "dropped"]);
    // Sent, a Cell on its way has its creature; one queued or dropped has none, and the foot goes.
    await expect.element(rowOf("Fix the importer").getByTestId("creature")).toBeInTheDocument();
    expect(document.querySelectorAll('[data-testid="creature"]')).toHaveLength(1);
    await expect.element(page.getByRole("button", { name: /^Send/ })).not.toBeInTheDocument();
    // The queued Cell's choices stand with its words, so the card keeps its height at Send.
    await expect
      .element(rowOf("Write its changelog").getByRole("button", { name: "Start now" }))
      .not.toBeInTheDocument();
    await userEvent.click(
      rowOf("Write its changelog").getByRole("button", { name: "What it's told" }),
    );
    await expect
      .element(rowOf("Write its changelog").getByRole("button", { name: "Start now" }))
      .toBeVisible();
  });

  it("holds Send while a Cell left on has no project, says so, and goes once one is picked", async () => {
    await using _screen = await show([
      cell(0, "Fix the importer"),
      cell(1, "Tidy the readme", { tier: "check", why: ["place-open"], place: null }),
    ]);
    await expect.element(page.getByRole("button", { name: /^Send 2/ })).toBeDisabled();
    await expect.element(page.getByRole("status")).toHaveTextContent("Pick a project");
    await userEvent.click(
      rowOf("Tidy the readme").getByRole("button", {
        name: "Project: Which project?",
        exact: true,
      }),
    );
    await userEvent.click(page.getByRole("menuitemradio", { name: "Atlas" }));
    await expect.element(page.getByRole("button", { name: /^Send 2/ })).toBeEnabled();
    expect(planOf("plan")?.tray?.acts[1]?.act.place).toMatchObject({ id: "atlas", how: "exact" });
    expect(statuses()).toEqual(["waiting", "waiting"]);

    // Cancel drops what waits, and the card leaves the composer.
    await userEvent.click(page.getByRole("button", { name: "Cancel" }));
    expect(planOf("plan")).toBeNull();
  });
});
