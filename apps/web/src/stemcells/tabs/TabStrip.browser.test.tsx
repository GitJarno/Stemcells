import "../upstream/appStyles";
import "../tokens/stemcells.css";
import "./workspace.css";

import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import { render } from "../upstream/testRender";
import { carryStarts } from "../windows/carrying";
import type { Tab } from "./layout";
import { TabStrip } from "./TabStrip";

const cell = (threadId: string) => ({ environmentId: "env", threadId, draftId: null });

/** A tab of the given chats side by side. */
function tabOf(id: string, threads: string[], name?: string): Tab {
  return {
    id,
    focusedPaneId: `${id}-p0`,
    rows: [
      {
        id: `${id}-r`,
        columns: threads.map((thread, index) => ({
          id: `${id}-c${index}`,
          panes: [{ id: `${id}-p${index}`, cell: cell(thread) }],
        })),
      },
    ],
    ...(name ? { name } : {}),
  };
}

function Strip(props: {
  tabs: Tab[];
  onRename?: (tabId: string, name: string | null) => void;
  onActivate?: (tabId: string) => void;
  onMove?: (tabId: string, toIndex: number) => void;
}) {
  return (
    <div style={{ width: 900 }}>
      <TabStrip
        tabs={props.tabs}
        activeTabId={props.tabs[0]!.id}
        aski={{ active: false, cell: cell("aski"), chat: { status: "starting" } }}
        newCell={null}
        newTabRef={{ current: null }}
        windowTabs={props.tabs.length + 1}
        onActivate={props.onActivate ?? (() => undefined)}
        onClose={() => undefined}
        onMove={props.onMove ?? (() => undefined)}
        onNew={() => undefined}
        onRename={props.onRename ?? (() => undefined)}
      />
      <div data-testid="away" style={{ height: 40 }} />
    </div>
  );
}

const chip = (container: HTMLElement, id: string) =>
  container.querySelector<HTMLElement>(`[data-stemcells-tab="${id}"]`)!;

function pointer(element: Element, type: string, x: number, y: number) {
  element.dispatchEvent(
    new PointerEvent(type, { bubbles: true, button: 0, pointerId: 1, clientX: x, clientY: y }),
  );
}

// The click is the tab's own: carrying a chip is built on it and never takes it away.
describe("clicking a tab", () => {
  it("opens it, though the hand wobbled, when it's let go in its own place", async () => {
    const onActivate = vi.fn();
    const onMove = vi.fn();
    await using screen = await render(
      <Strip
        tabs={[tabOf("t1", ["a"]), tabOf("t2", ["b"])]}
        onActivate={onActivate}
        onMove={onMove}
      />,
    );
    const second = chip(screen.container, "t2");
    const box = second.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    pointer(second, "pointerdown", x, y);
    pointer(second, "pointermove", x + 9, y + 2);
    pointer(second, "pointerup", x + 9, y + 2);
    expect(onActivate).toHaveBeenCalledWith("t2");
    expect(onMove).not.toHaveBeenCalled();
  });

  it("opens it on the press while something else is in the hand", async () => {
    const onActivate = vi.fn();
    await using screen = await render(
      <Strip tabs={[tabOf("t1", ["a"]), tabOf("t2", ["b"])]} onActivate={onActivate} />,
    );
    using _held = { [Symbol.dispose]: carryStarts() };
    await userEvent.click(chip(screen.container, "t2"));
    expect(onActivate).toHaveBeenCalledWith("t2");
  });

  it("never opens from its close button", async () => {
    const onActivate = vi.fn();
    await using screen = await render(
      <Strip tabs={[tabOf("t1", ["a"]), tabOf("t2", ["b"])]} onActivate={onActivate} />,
    );
    using _held = { [Symbol.dispose]: carryStarts() };
    await userEvent.click(chip(screen.container, "t2").querySelector("button")!);
    expect(onActivate).not.toHaveBeenCalled();
  });
});
const field = (container: HTMLElement) => container.querySelector<HTMLInputElement>("input");

describe("renaming a tab by its name", () => {
  it("a tab of several Cells takes a name of its own: Enter keeps it, in place", async () => {
    const onRename = vi.fn();
    const onMove = vi.fn();
    await using screen = await render(
      <Strip
        tabs={[tabOf("t1", ["a", "b"]), tabOf("t2", ["c"])]}
        onRename={onRename}
        onMove={onMove}
      />,
    );
    const tab = chip(screen.container, "t1");
    const width = tab.getBoundingClientRect().width;
    await userEvent.dblClick(tab.querySelector("span.truncate")!);
    const input = field(screen.container)!;
    expect(input.getAttribute("aria-label")).toBe("Tab name");
    expect(document.activeElement).toBe(input);
    // Its chats have no titles here, so the tab is named "New Cell".
    expect(input.value).toBe("New Cell");
    expect(tab.textContent).toContain("· 2");
    // A long name scrolls in the field; the tab keeps its width throughout.
    await userEvent.keyboard("A name much longer than any tab has room for");
    expect(tab.getBoundingClientRect().width).toBe(width);
    expect(tab.hasAttribute("data-dragged")).toBe(false);
    await userEvent.keyboard("{Enter}");
    expect(onRename).toHaveBeenCalledWith("t1", "A name much longer than any tab has room for");
    expect(field(screen.container)).toBeNull();
    expect(onMove).not.toHaveBeenCalled();
  });

  it("shows the name it was given while it holds several Cells, and a cleared name gives the automatic one back", async () => {
    const onRename = vi.fn();
    await using screen = await render(
      <Strip tabs={[tabOf("t1", ["a", "b"], "Billing")]} onRename={onRename} />,
    );
    const tab = chip(screen.container, "t1");
    expect(tab.querySelector("span.truncate")!.textContent).toBe("Billing · 2");
    await userEvent.dblClick(tab.querySelector("span.truncate")!);
    await userEvent.clear(field(screen.container)!);
    await userEvent.keyboard("{Enter}");
    expect(onRename).toHaveBeenCalledWith("t1", null);
  });

  it("Escape keeps the old name, leaving keeps the new one, an unchanged one changes nothing", async () => {
    const onRename = vi.fn();
    await using screen = await render(
      <Strip tabs={[tabOf("t1", ["a", "b"], "Billing")]} onRename={onRename} />,
    );
    const tab = chip(screen.container, "t1");
    const name = () => tab.querySelector("span.truncate")!;
    await userEvent.dblClick(name());
    await userEvent.keyboard("Payments{Escape}");
    expect(field(screen.container)).toBeNull();
    expect(onRename).not.toHaveBeenCalled();

    await userEvent.dblClick(name());
    await userEvent.keyboard("{Enter}");
    expect(onRename).not.toHaveBeenCalled();

    await userEvent.dblClick(name());
    await userEvent.keyboard("Payments");
    await userEvent.click(screen.container.querySelector('[data-testid="away"]')!);
    expect(onRename).toHaveBeenCalledWith("t1", "Payments");
  });

  // ⌘T while the field was new opened a Cell whose composer the field took
  // the focus back from, so the prompt typed next renamed this tab.
  it("a shortcut while it is open sends the keys where the shortcut put the focus", async () => {
    const onRename = vi.fn();
    await using screen = await render(
      <Strip tabs={[tabOf("t1", ["a", "b"], "Billing")]} onRename={onRename} />,
    );
    const away = screen.container.querySelector<HTMLElement>('[data-testid="away"]')!;
    away.tabIndex = -1;
    const newCell = (event: KeyboardEvent) => {
      if (event.key !== "t" || !event.metaKey) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      away.focus();
    };
    window.addEventListener("keydown", newCell, true);
    try {
      await userEvent.dblClick(chip(screen.container, "t1").querySelector("span.truncate")!);
      expect(document.activeElement).toBe(field(screen.container));
      await userEvent.keyboard("{Meta>}t{/Meta}");
      await vi.waitFor(() => {
        expect(document.activeElement).toBe(away);
        expect(field(screen.container)).toBeNull();
      });
      await userEvent.keyboard("Fix the build");
      expect(onRename).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("keydown", newCell, true);
    }
  });

  // The chat's title is its one-liner, which the phone and the other Cells
  // read: a tab of one Cell takes a name of its own too. Aski's tab never opens.
  it("a tab of one Cell names the tab, not its chat, and shows that name; Aski's tab doesn't open", async () => {
    const onRename = vi.fn();
    await using screen = await render(
      <Strip tabs={[tabOf("t1", ["a"]), tabOf("t2", ["b"], "KI")]} onRename={onRename} />,
    );
    expect(chip(screen.container, "t2").querySelector("span.truncate")!.textContent).toBe("KI");
    await userEvent.dblClick(chip(screen.container, "t1").querySelector("span.truncate")!);
    expect(field(screen.container)!.getAttribute("aria-label")).toBe("Tab name");
    await userEvent.keyboard("Billing{Enter}");
    expect(onRename).toHaveBeenCalledWith("t1", "Billing");
    await userEvent.dblClick(chip(screen.container, "aski"));
    expect(field(screen.container)).toBeNull();
  });

  it("a single click only opens the tab, and a press in the field never drags it", async () => {
    const onActivate = vi.fn();
    const onMove = vi.fn();
    await using screen = await render(
      <Strip
        tabs={[tabOf("t1", ["a", "b"]), tabOf("t2", ["c", "d"])]}
        onActivate={onActivate}
        onMove={onMove}
      />,
    );
    const second = chip(screen.container, "t2");
    await userEvent.click(second);
    expect(onActivate).toHaveBeenLastCalledWith("t2");
    expect(field(screen.container)).toBeNull();

    await userEvent.dblClick(second.querySelector("span.truncate")!);
    const input = field(screen.container)!;
    const box = input.getBoundingClientRect();
    input.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        pointerId: 7,
        clientX: box.left + 4,
        clientY: box.top + 4,
      }),
    );
    input.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        pointerId: 7,
        clientX: box.left - 200,
        clientY: box.top + 4,
      }),
    );
    expect(second.hasAttribute("data-dragged")).toBe(false);
    expect(second.hasPointerCapture(7)).toBe(false);
    expect(onMove).not.toHaveBeenCalled();
  });
});
