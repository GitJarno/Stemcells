// @effect-diagnostics nodeBuiltinImport:off - loads the CommonJS lab helper.
/**
 * The lab helper's guard (never-shown.cjs), against a stand-in Electron: a
 * window it makes never shows or lands on a display, and one that does
 * anyway ends the lab.
 */
import * as NodeEvents from "node:events";
import * as NodeModule from "node:module";
import { describe, expect, it } from "vite-plus/test";

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface Display {
  id: number;
  bounds: Bounds;
}
interface Lab {
  LAB_EXIT: number;
  install(electron: unknown, runtime: unknown): Record<string, any>;
  labWindowOptions(options: Record<string, unknown> | undefined, displays: Display[]): any;
  offDisplays(displays: Display[], width: number): { x: number; y: number };
  violation(window: unknown, displays: Display[]): string | null;
  intersects(a: Bounds, b: Bounds): boolean;
}
const lab = NodeModule.createRequire(import.meta.url)("./never-shown.cjs") as Lab;

const LAYOUTS: Record<string, Display[]> = {
  "one display": [{ id: 1, bounds: { x: 0, y: 0, width: 1728, height: 1117 } }],
  "one to the left": [
    { id: 1, bounds: { x: 0, y: 0, width: 1728, height: 1117 } },
    { id: 2, bounds: { x: -2560, y: -300, width: 2560, height: 1440 } },
  ],
  "one far right and above": [
    { id: 1, bounds: { x: 0, y: 0, width: 1728, height: 1117 } },
    { id: 2, bounds: { x: 1728, y: -1440, width: 5120, height: 2880 } },
  ],
};

/** A stand-in for Electron: windows keep their state, and what reached the screen is recorded. */
function fakeElectron(displays: Display[]) {
  const reached: string[] = [];
  const app = Object.assign(new NodeEvents.EventEmitter(), {
    paths: {} as Record<string, string>,
    exitCode: null as number | null,
    setPath(name: string, path: string) {
      this.paths[name] = path;
    },
    exit(code: number) {
      this.exitCode = code;
    },
    focus: () => reached.push("app.focus"),
    setActivationPolicy: (policy: string) => reached.push(`policy ${policy}`),
    dock: { show: () => reached.push("dock.show"), hide: () => {}, bounce: () => 1 },
    whenReady: () => ready.promise,
  });
  const ready = Promise.withResolvers<void>();
  const all = new Set<FakeWindow>();
  class FakeWindow extends NodeEvents.EventEmitter {
    static getAllWindows = () => [...all];
    options: Record<string, any>;
    bounds: Bounds;
    visible = false;
    destroyed = false;
    webContents = {
      setBackgroundThrottling: () => {},
      openDevTools: () => reached.push("devtools"),
    };
    constructor(options: Record<string, any> = {}) {
      super();
      this.options = options;
      this.bounds = {
        x: options.x ?? 100,
        y: options.y ?? 100,
        width: options.width ?? 800,
        height: options.height ?? 600,
      };
      if (options.show !== false) this.show();
      all.add(this);
    }
    show() {
      this.visible = true;
      reached.push("show");
      this.emit("show");
    }
    focus() {
      reached.push("focus");
    }
    isVisible() {
      return this.visible;
    }
    isDestroyed() {
      return this.destroyed;
    }
    destroy() {
      this.destroyed = true;
      all.delete(this);
    }
    getBounds() {
      return { ...this.bounds };
    }
    setBounds(bounds: Partial<Bounds>) {
      this.bounds = { ...this.bounds, ...bounds };
      this.emit("move");
    }
    setContentBounds(bounds: Partial<Bounds>) {
      this.setBounds(bounds);
    }
    setPosition(x: number, y: number) {
      this.bounds = { ...this.bounds, x, y };
      this.emit("move");
    }
    setIgnoreMouseEvents() {}
  }
  const electron = {
    app,
    screen: Object.assign(new NodeEvents.EventEmitter(), { getAllDisplays: () => displays }),
    BrowserWindow: FakeWindow,
    BaseWindow: FakeWindow,
    dialog: { showMessageBox: () => reached.push("dialog") },
    shell: { openExternal: () => reached.push("openExternal") },
    globalShortcut: { register: () => reached.push("shortcut") },
    clipboard: { writeText: () => reached.push("clipboard") },
    Menu: class {
      popup() {
        reached.push("menu");
      }
    },
    Notification: class {
      show() {
        reached.push("notification");
      }
    },
  };
  let watch = () => {};
  const runtime = {
    profile: "/tmp/stemcells-lab-test",
    served: () => true,
    log: () => {},
    setInterval: (fn: () => void) => {
      watch = fn;
    },
  };
  return {
    electron,
    runtime,
    reached,
    FakeWindow,
    ready: async () => {
      ready.resolve();
      await ready.promise;
      await Promise.resolve();
    },
    watch: () => watch(),
  };
}

describe("the lab's window options", () => {
  it("keep a window hidden, clear, off every display, and rendering", () => {
    for (const [layout, displays] of Object.entries(LAYOUTS)) {
      const options = lab.labWindowOptions(
        { x: 40, y: 60, width: 1200, height: 760, show: true, center: true, title: "kept" },
        displays,
      );
      expect(options, layout).toMatchObject({
        show: false,
        opacity: 0,
        center: false,
        enableLargerThanScreen: true,
        paintWhenInitiallyHidden: true,
        title: "kept",
        webPreferences: { backgroundThrottling: false },
      });
      const bounds = { x: options.x, y: options.y, width: 1200, height: 760 };
      expect(
        displays.some((display) => lab.intersects(bounds, display.bounds)),
        layout,
      ).toBe(false);
    }
  });
});

describe("the lab's guard", () => {
  it("makes every window hidden and off every display, and keeps it there", async () => {
    const fake = fakeElectron(LAYOUTS["one to the left"]!);
    const electron = lab.install(fake.electron, fake.runtime);
    await fake.ready();
    const window = new electron.BrowserWindow({ x: 10, y: 10 });
    window.show();
    window.focus();
    window.setBounds({ x: 10, y: 10, width: 500 });
    window.setPosition(10, 10);
    window.webContents.openDevTools();
    await Promise.resolve();
    fake.watch();
    expect(window).toBeInstanceOf(fake.FakeWindow);
    expect(window.isVisible()).toBe(false);
    expect(lab.violation(window, LAYOUTS["one to the left"]!)).toBeNull();
    expect(fake.reached).toEqual(["policy accessory"]);
    expect(fake.electron.app.exitCode).toBeNull();
  });

  it("lets nothing else reach the person, and keeps its own profile", async () => {
    const fake = fakeElectron(LAYOUTS["one display"]!);
    const electron = lab.install(fake.electron, fake.runtime);
    await fake.ready();
    electron.app.setPath("userData", "/Users/example/Library/Application Support/app");
    electron.app.focus();
    electron.app.dock.show();
    electron.dialog.showMessageBox();
    electron.shell.openExternal("https://example.com");
    expect(electron.globalShortcut.register("Cmd+K", () => {})).toBe(false);
    electron.clipboard.writeText("lab");
    new electron.Menu().popup();
    new electron.Notification().show();
    expect(fake.reached).toEqual(["policy accessory"]);
    expect(fake.electron.app.paths.userData).toBe("/tmp/stemcells-lab-test");
  });

  it("ends the lab when a window is shown by a way it doesn't cover", async () => {
    const fake = fakeElectron(LAYOUTS["one display"]!);
    const electron = lab.install(fake.electron, fake.runtime);
    await fake.ready();
    const window = new electron.BrowserWindow();
    fake.FakeWindow.prototype.show.call(window);
    expect(fake.electron.app.exitCode).toBe(lab.LAB_EXIT);
    expect(window.isDestroyed()).toBe(true);
  });

  it("ends the lab when a hidden window's bounds touch a display", async () => {
    const fake = fakeElectron(LAYOUTS["one far right and above"]!);
    const electron = lab.install(fake.electron, fake.runtime);
    await fake.ready();
    const window = new electron.BrowserWindow();
    await Promise.resolve();
    fake.FakeWindow.prototype.setPosition.call(window, 2000, -200);
    expect(fake.electron.app.exitCode).toBe(lab.LAB_EXIT);
    expect(window.isDestroyed()).toBe(true);
  });

  it("ends the lab when the watchdog finds a window it never saw made", async () => {
    const fake = fakeElectron(LAYOUTS["one display"]!);
    lab.install(fake.electron, fake.runtime);
    await fake.ready();
    const window = new fake.FakeWindow({ show: false, x: 300, y: 200 });
    fake.watch();
    expect(fake.electron.app.exitCode).toBe(lab.LAB_EXIT);
    expect(window.isDestroyed()).toBe(true);
  });

  it("ends the lab when the app read electron without require(), so its windows were never made hidden", async () => {
    const fake = fakeElectron(LAYOUTS["one display"]!);
    lab.install(fake.electron, { ...fake.runtime, served: () => false });
    await fake.ready();
    expect(fake.electron.app.exitCode).toBe(lab.LAB_EXIT);
  });
});
