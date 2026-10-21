import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { workspaceKeyListeners, type WorkspaceKeyHandlers } from "./useWorkspaceKeys";

const key = (name: string, more: Partial<KeyboardEvent> = {}) =>
  Object.assign(new Event("keydown", { cancelable: true }), {
    key: name,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    ...more,
  }) as KeyboardEvent;

const handlers = () => ({
  newCell: vi.fn(() => true),
  closeTab: vi.fn(() => true),
  splitRight: vi.fn(() => true),
  splitDown: vi.fn(() => true),
  closePane: vi.fn(() => true),
});

/** What ran for one key pressed with focus on `activeElement`. */
function press(event: KeyboardEvent, workspace: WorkspaceKeyHandlers) {
  workspaceKeyListeners(() => workspace).onKeyDownCapture(event);
  return event;
}

class Element {
  isConnected = true;
  constructor(private readonly owner: string | null) {}
  closest() {
    return this.owner ? { dataset: { terminalOwner: this.owner } } : null;
  }
}

beforeEach(() => {
  vi.stubGlobal("HTMLElement", Element);
  vi.stubGlobal("document", { activeElement: new Element(null), querySelector: () => null });
  vi.stubGlobal("navigator", { platform: "MacIntel" });
});

describe("⌘T", () => {
  it("opens a new Cell in the tab, not a new tab (it opened a tab), ahead of upstream's ⌘T", () => {
    const workspace = handlers();
    const event = press(key("t", { metaKey: true }), workspace);
    expect(workspace.newCell).toHaveBeenCalledOnce();
    expect(workspace.splitRight).not.toHaveBeenCalled();
    expect(workspace.splitDown).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it("stays the terminal's while a terminal has focus", () => {
    vi.stubGlobal("document", { activeElement: new Element("drawer"), querySelector: () => null });
    const workspace = handlers();
    const event = press(key("t", { metaKey: true }), workspace);
    expect(workspace.newCell).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
