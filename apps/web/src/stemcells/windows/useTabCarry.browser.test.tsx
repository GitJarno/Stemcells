import "../upstream/appStyles";
import "../tokens/stemcells.css";
import "../tabs/workspace.css";

import { describe, expect, it, vi } from "vite-plus/test";

import type { Tab } from "../tabs/layout";
import { TabStrip } from "../tabs/TabStrip";
import { render } from "../upstream/testRender";
import type { WindowsBridge } from "./bridge";
import { carrying } from "./carrying";

const cell = (threadId: string) => ({ environmentId: "env", threadId, draftId: null });

const tabOf = (id: string): Tab => ({
  id,
  focusedPaneId: `${id}-p`,
  rows: [
    { id: `${id}-r`, columns: [{ id: `${id}-c`, panes: [{ id: `${id}-p`, cell: cell(id) }] }] },
  ],
});

/** The desktop app as a carry sees it, a layer that paints at once, for as long as it's held. */
function desktop() {
  const bridge = {
    boot: { id: "here", lead: true, workspace: null, others: [], notifies: true },
    zoom: () => 1,
    snapshot: () => Promise.resolve({ windows: [], lead: null, memories: [], displays: [] }),
    still: () => Promise.resolve("data:image/gif;base64,R0lGODlhAQABAAAAACw="),
    flight: vi.fn(),
    painted: () => Promise.resolve(),
    endFlight: vi.fn(),
    // The rest of what a carry asks of the desktop app, answered as for a lone window.
    geometry: () => Promise.resolve([]),
    commit: () => Promise.resolve("stale"),
    warm: () => undefined,
    room: () => undefined,
    raise: () => undefined,
    moveWindow: () => undefined,
    windowShown: () => undefined,
    drawn: () => undefined,
    shownFrame: () => Promise.resolve(null),
    onLanded: () => () => undefined,
    onMeasure: () => () => undefined,
    onRoom: () => () => undefined,
    onArranged: () => () => undefined,
  };
  Object.defineProperty(window, "stemcellsWindows", {
    value: bridge as unknown as WindowsBridge,
    configurable: true,
  });
  return {
    bridge,
    [Symbol.dispose]: () => void Reflect.deleteProperty(window, "stemcellsWindows"),
  };
}

function Strip() {
  const tabs = [tabOf("t1"), tabOf("t2")];
  return (
    <div style={{ width: 900 }}>
      <TabStrip
        tabs={tabs}
        activeTabId="t1"
        aski={{ active: false, cell: cell("aski"), chat: { status: "starting" } }}
        newCell={null}
        newTabRef={{ current: null }}
        windowTabs={3}
        onActivate={() => undefined}
        onClose={() => undefined}
        onMove={() => undefined}
        onNew={() => undefined}
        onRename={() => undefined}
      />
    </div>
  );
}

const chipOf = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-stemcells-tab="t2"]')!;

/** The mouse's pointer, as the page sees it, at `x, y` (the window sits at the screen's origin). */
function pointer(element: HTMLElement, type: string, x: number, y: number) {
  element.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      button: 0,
      pointerId: 1,
      clientX: x,
      clientY: y,
      screenX: x,
      screenY: y,
    }),
  );
}

/**
 * Presses t2's chip and moves past the strip's tear band: in one sample, or
 * `along` the strip first.
 */
async function flick(container: HTMLElement, along = false) {
  const chip = chipOf(container);
  const box = chip.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  pointer(chip, "pointerdown", x, y);
  if (along) pointer(chip, "pointermove", x + 10, y);
  pointer(chip, "pointermove", x + 40, y + 200);
  // Once the layer has it, the strip lets its chip go: one chip, on the layer.
  await expect.poll(() => chip.style.visibility).toBe("hidden");
  expect(carrying()).toBe(true);
  return chip;
}

/** The carry went home: the layer ended, and the chip is back in the strip. */
async function home(chip: HTMLElement, bridge: ReturnType<typeof desktop>["bridge"]) {
  await expect.poll(() => bridge.endFlight.mock.calls.length, { timeout: 3000 }).toBe(1);
  expect(chip.style.visibility).not.toBe("hidden");
  expect(carrying()).toBe(false);
}

describe("a tab's chip flicked off its strip", () => {
  it("is a carry from its first move past the band: drawn once, and Esc sends it home", async () => {
    using app = desktop();
    await using screen = await render(<Strip />);
    const chip = await flick(screen.container);

    const esc = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    window.dispatchEvent(esc);
    expect(esc.defaultPrevented).toBe(true);
    await home(chip, app.bridge);
  });

  it.each([
    ["the pointer is cancelled", (chip: HTMLElement) => pointer(chip, "pointercancel", 0, 0)],
    ["the pointer is lost", (chip: HTMLElement) => pointer(chip, "lostpointercapture", 0, 0)],
    ["the window loses focus", () => void window.dispatchEvent(new FocusEvent("blur"))],
  ] as const)("goes home when %s", async (_how, lose) => {
    using app = desktop();
    await using screen = await render(<Strip />);
    const chip = await flick(screen.container, true);
    lose(chip);
    await home(chip, app.bridge);
  });
});
