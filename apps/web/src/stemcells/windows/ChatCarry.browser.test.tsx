import "../upstream/appStyles";
import "../tokens/stemcells.css";

import { describe, expect, it } from "vite-plus/test";

import { activateTab, panesOf, type Tab } from "../tabs/layout";
import { readWorkspace, updateWorkspace } from "../tabs/store";
import { render } from "../upstream/testRender";
import { carrying } from "./carrying";
import { ChatCarry, startChatCarry, useCarryLit } from "./ChatCarry";

const cell = { environmentId: "env", threadId: "t1", draftId: null };

/** A slate holding one pane, whose Cell is the handle a chat is carried by, unless it's gone. */
function Slate(props: { cellGone?: boolean }) {
  return (
    <div style={{ position: "relative", width: 600, height: 400 }}>
      <ChatCarry onOpenTab={() => undefined} />
      <div data-stemcells-pane="p1" style={{ width: 300, height: 400 }}>
        {props.cellGone ? null : (
          <button type="button" onPointerDown={(event) => startChatCarry(event, cell)}>
            Cell
          </button>
        )}
      </div>
    </div>
  );
}

function pointer(element: Element, type: string, x: number, y: number, at?: number) {
  const event = new PointerEvent(type, {
    bubbles: true,
    button: 0,
    pointerId: 1,
    clientX: x,
    clientY: y,
  });
  // The hand's speed is read from the events' times.
  if (at !== undefined) Object.defineProperty(event, "timeStamp", { value: at });
  element.dispatchEvent(event);
}

const card = () => document.querySelector("[data-stemcells-chat-card]");

/** Picks the chat up by its Cell: the card is in the hand. */
function lift(container: HTMLElement): HTMLElement {
  const handle = container.querySelector("button")!;
  const box = handle.getBoundingClientRect();
  pointer(handle, "pointerdown", box.left + 4, box.top + 4);
  pointer(handle, "pointermove", box.left + 40, box.top + 40);
  return handle;
}

describe("a chat carried by its Cell", () => {
  it.each([
    ["the pointer is cancelled", (handle: Element) => pointer(handle, "pointercancel", 0, 0)],
    ["the pointer is lost", (handle: Element) => pointer(handle, "lostpointercapture", 0, 0)],
    ["the window loses focus", () => void window.dispatchEvent(new FocusEvent("blur"))],
  ] as const)("goes back when %s, and holds the keys off till then", async (_how, lose) => {
    await using screen = await render(<Slate />);
    const handle = lift(screen.container);
    await expect.poll(card).not.toBeNull();
    expect(carrying()).toBe(true);

    lose(handle);
    await expect.poll(card, { timeout: 3000 }).toBeNull();
    expect(carrying()).toBe(false);
    expect(handle.dataset.carrying).toBeUndefined();
  });

  // Left in the hand, the carry would hold every tab's chip and the keys
  // that wait on one (Gather, Undo Move) off for the rest of the session.
  it("thrown, leaves the hand empty", async () => {
    await using screen = await render(<Slate />);
    const handle = screen.container.querySelector("button")!;
    const box = handle.getBoundingClientRect();
    // The hand's own clock: only the gaps between its events count.
    const t = 1000;
    pointer(handle, "pointerdown", box.left + 4, box.top + 4, t);
    pointer(handle, "pointermove", box.left + 40, box.top + 40, t + 10);
    await expect.poll(card).not.toBeNull();
    pointer(handle, "pointermove", box.left + 240, box.top + 40, t + 30);
    pointer(handle, "pointerup", box.left + 240, box.top + 40, t + 40);

    await expect.poll(card).toBeNull();
    expect(carrying()).toBe(false);
  });

  it("goes back when its Cell goes mid-carry, and the document hears the pointer lost", async () => {
    await using screen = await render(<Slate />);
    lift(screen.container);
    await expect.poll(card).not.toBeNull();

    await screen.rerender(<Slate cellGone />);
    document.dispatchEvent(new PointerEvent("lostpointercapture", { pointerId: 1 }));
    await expect.poll(card, { timeout: 3000 }).toBeNull();
    expect(carrying()).toBe(false);
  });
});

/** A tab of one chat, its pane `<id>.p`. */
const oneChat = (id: string, threadId: string): Tab => ({
  id,
  rows: [
    {
      id: `${id}.r`,
      columns: [{ id: `${id}.c`, panes: [{ id: `${id}.p`, cell: { ...cell, threadId } }] }],
    },
  ],
  focusedPaneId: `${id}.p`,
});

/** Tab "a" on stage holding the carried chat and another, tab "b" holding one: the strip's chips. */
function setup() {
  const a = oneChat("a", "t1");
  const withSecond: Tab = {
    ...a,
    rows: [
      { ...a.rows[0]!, columns: [...a.rows[0]!.columns, oneChat("a2", "t3").rows[0]!.columns[0]!] },
    ],
  };
  updateWorkspace(() => ({ tabs: [withSecond, oneChat("b", "t2")], activeTabId: "a" }));
}

function Strip() {
  const lit = useCarryLit();
  return (
    <div data-stemcells-tab-strip="" style={{ display: "flex", width: 600, height: 36 }}>
      {["a", "b"].map((id) => (
        <div
          key={id}
          data-stemcells-tab={id}
          data-spring-lit={lit === id}
          style={{ width: 160, height: 36 }}
        />
      ))}
    </div>
  );
}

function Workspace() {
  return (
    <div style={{ width: 600 }}>
      <ChatCarry onOpenTab={(tabId) => updateWorkspace((ws) => activateTab(ws, tabId))} />
      <Strip />
      <div data-stemcells-pane="a.p" style={{ width: 300, height: 300 }}>
        <button type="button" onPointerDown={(event) => startChatCarry(event, cell)}>
          Cell
        </button>
      </div>
    </div>
  );
}

const chip = (id: string) => document.querySelector<HTMLElement>(`[data-stemcells-tab="${id}"]`)!;
const panes = (tabId: string) =>
  panesOf(readWorkspace().tabs.find((tab) => tab.id === tabId)!).map((pane) => pane.id);

describe("a chat let go on a tab's chip", () => {
  it("goes to the end of that tab, its chip lit on the way, and the stage stays", async () => {
    setup();
    await using screen = await render(<Workspace />);
    const handle = lift(screen.container);
    await expect.poll(card).not.toBeNull();

    // Flung at the chip: a let-go there aims, so it drops rather than throws.
    const over = chip("b").getBoundingClientRect();
    pointer(handle, "pointermove", over.left + 80, over.top + 18);
    await expect.element(chip("b")).toHaveAttribute("data-spring-lit", "true");
    pointer(handle, "pointerup", over.left + 80, over.top + 18);

    await expect.poll(() => panes("b")).toEqual(["b.p", "a.p"]);
    expect(panes("a")).toEqual(["a2.p"]);
    expect(readWorkspace().activeTabId).toBe("a");
    await expect.poll(card).toBeNull();
    expect(chip("b").dataset.springLit).toBe("false");
    expect(carrying()).toBe(false);
  });

  it("takes nothing on its own tab's chip, which never lights: the chat flies home", async () => {
    setup();
    await using screen = await render(<Workspace />);
    const handle = lift(screen.container);
    await expect.poll(card).not.toBeNull();

    const own = chip("a").getBoundingClientRect();
    pointer(handle, "pointermove", own.left + 80, own.top + 18);
    expect(chip("a").dataset.springLit).toBe("false");
    pointer(handle, "pointerup", own.left + 80, own.top + 18);

    await expect.poll(card).toBeNull();
    expect(panes("a")).toEqual(["a.p", "a2.p"]);
    expect(panes("b")).toEqual(["b.p"]);
  });
});
