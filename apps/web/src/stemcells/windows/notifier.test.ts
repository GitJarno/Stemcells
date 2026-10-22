import { afterEach, describe, expect, it, vi } from "vite-plus/test";

/** notifier.ts as a desktop window loads it, and the way the app tells it it notifies now. */
async function loadNotifier(boot: { readonly lead: boolean; readonly notifies: boolean }) {
  let tell: (notifies: boolean) => void = () => {};
  vi.stubGlobal("window", {
    stemcellsWindows: {
      boot: { id: "w1", workspace: null, others: [], ...boot },
      onNotifies: (listener: (notifies: boolean) => void) => {
        tell = listener;
        return () => {};
      },
    },
  });
  vi.resetModules();
  const notifier = await import("./notifier");
  return { notifiesHere: notifier.notifiesHere, tell: (value: boolean) => tell(value) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the window that raises the chats' notifications", () => {
  it("is the one the app names, not the lead: a focused window that doesn't lead notifies", async () => {
    const focused = await loadNotifier({ lead: false, notifies: true });
    expect(focused.notifiesHere()).toBe(true);
    const lead = await loadNotifier({ lead: true, notifies: false });
    expect(lead.notifiesHere()).toBe(false);
  });

  it("follows the app as focus moves between windows", async () => {
    const { notifiesHere, tell } = await loadNotifier({ lead: true, notifies: true });
    tell(false);
    expect(notifiesHere()).toBe(false);
    tell(true);
    expect(notifiesHere()).toBe(true);
  });

  it("is a browser's one window, always", async () => {
    vi.stubGlobal("window", {});
    vi.resetModules();
    const { notifiesHere } = await import("./notifier");
    expect(notifiesHere()).toBe(true);
  });
});
