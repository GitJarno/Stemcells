/**
 * Stemcells' theme is built in (look.ts, substitutes/themePalettes.ts), so
 * the app wears it from its first frame. Published by the server only, it
 * resolved when the server's theme event came, a couple of seconds into a
 * launch in the desktop app, and until then T3's stock palette painted: a
 * lighter frame round the slate, the slate's edge and the column's border.
 * It is also what a launch with nothing stored opens on, where upstream
 * opened on T3's stock theme. These pin the parts: the theme module's first
 * paint, the boot script's splash before it (index.html), the default, the
 * server's copy left out, and Settings' card. A failure after a sync names
 * the part that moved.
 */
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { T3_CODE_DARK_THEME_COLORS } from "@t3tools/shared/themePalettes";

import indexHtml from "../../../index.html?raw";
import themeSettings from "../../components/settings/ThemeSettings.tsx?raw";
import useEnvironmentTheme from "../../hooks/useEnvironmentTheme.ts?raw";
import { STEMCELLS_OVER_T3_DARK } from "../../../../../stemcells/brand/look.ts";
import { STEMCELLS_THEME } from "./look";

const { canvas, text, accent, chrome } = STEMCELLS_THEME.colors;

/** A launch's document and storage, with the app's theme module loaded fresh. */
async function loadTheme(storage: Record<string, string>, prefersDark: boolean) {
  vi.resetModules();
  const styles = new Map<string, string>();
  const classes = new Set<string>();
  const root = {
    dataset: {} as Record<string, string | undefined>,
    style: {
      backgroundColor: "",
      setProperty: (name: string, value: string) => styles.set(name, value),
      removeProperty: (name: string) => styles.delete(name),
    },
    classList: {
      add: (name: string) => classes.add(name),
      remove: (name: string) => classes.delete(name),
      toggle: (name: string, enabled: boolean) =>
        enabled ? classes.add(name) : classes.delete(name),
      contains: (name: string) => classes.has(name),
    },
  };
  vi.stubGlobal("document", { documentElement: root });
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => storage[key] ?? null,
      setItem: vi.fn(),
      removeItem: vi.fn(),
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    matchMedia: () => ({
      matches: prefersDark,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
  vi.stubGlobal("requestAnimationFrame", vi.fn());
  const palette = await import("../../themePalette");
  // Loading the module applies the stored preference: the app's first paint.
  await import("../../hooks/useTheme");
  return { palette, root, classes, styles };
}

/** index.html's boot script, run before any module loads. */
function bootSplash(storage: Record<string, string>, prefersDark: boolean) {
  const script = /<script>([\s\S]*?)<\/script>/.exec(indexHtml)?.[1];
  if (!script) throw new Error("No inline boot script in index.html");
  const classes = new Set<string>();
  const boot: Record<string, string> = {};
  const root = {
    dataset: {} as Record<string, string | undefined>,
    classList: {
      toggle: (name: string, force: boolean) => (force ? classes.add(name) : classes.delete(name)),
    },
    style: {
      backgroundColor: "",
      setProperty: (name: string, value: string) => (boot[name] = value),
    },
  };
  new Function("window", "document", "CSS", script)(
    {
      localStorage: { getItem: (key: string) => storage[key] ?? null },
      matchMedia: () => ({ matches: prefersDark }),
    },
    { documentElement: root, querySelectorAll: () => [] },
    { supports: () => true },
  );
  return {
    themeId: root.dataset.themeId,
    dark: classes.has("dark"),
    boot,
    ground: root.style.backgroundColor,
  };
}

const CHOSEN = { "t3code:theme": "stemcells" };

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe("Stemcells' theme is built in", () => {
  it.each([
    ["a dark Mac", true],
    ["a light Mac", false],
  ])("the app's first paint wears it, on %s, before the server says anything", async (_, dark) => {
    const { palette, root, classes, styles } = await loadTheme(CHOSEN, dark);
    expect(root.dataset.themeId).toBe("stemcells");
    expect(classes.has("dark")).toBe(true);
    expect(styles.get(palette.getThemeColorVariable("canvas"))).toBe(canvas);
    expect(styles.get(palette.getThemeColorVariable("chrome"))).toBe(chrome);
  });

  it("is the look the server publishes, in the form upstream writes built-ins in", async () => {
    // The colours the server's published file gives once the theme module
    // reads them (environmentThemeDefinition), so the two can't drift.
    const { palette } = await loadTheme({}, true);
    const published = { ...T3_CODE_DARK_THEME_COLORS, ...STEMCELLS_OVER_T3_DARK };
    expect(STEMCELLS_THEME.appearance).toBe("dark");
    expect(STEMCELLS_THEME.colors).toEqual(
      Object.fromEntries(
        Object.entries(published).map(([role, value]) => [
          role,
          palette.toCanonicalThemeColor(value),
        ]),
      ),
    );
  });

  it.each([
    ["a dark Mac", true],
    ["a light Mac", false],
  ])("the splash before it wears it too, on %s", (_, dark) => {
    const splash = bootSplash({ ...CHOSEN, "t3code:theme-appearance-mode": "system" }, dark);
    expect(splash.themeId).toBe("stemcells");
    expect(splash.dark).toBe(true);
    expect(splash.boot).toEqual({
      "--boot-background": canvas,
      "--boot-foreground": text,
      "--boot-accent": accent,
      "--boot-chrome": chrome,
    });
    expect(splash.ground).toBe(chrome);
  });

  it.each([
    ["a dark Mac", true],
    ["a light Mac", false],
  ])("a launch with nothing stored opens on it, on %s, splash first", async (_, dark) => {
    const splash = bootSplash({}, dark);
    expect([splash.themeId, splash.dark, splash.ground]).toEqual(["stemcells", true, chrome]);
    expect(splash.boot["--boot-background"]).toBe(canvas);
    const { root, classes } = await loadTheme({}, dark);
    expect([root.dataset.themeId, classes.has("dark")]).toEqual(["stemcells", true]);
  });

  it("its id is reserved, so the server's published copy is left out", async () => {
    const { palette } = await loadTheme({}, true);
    expect(palette.isReservedThemeId("stemcells")).toBe(true);
    expect(palette.getThemeDefinition("stemcells")).toEqual(STEMCELLS_THEME);
    expect(useEnvironmentTheme).toContain("if (isReservedThemeId(theme.id)) return false;");
  });

  it("Settings lists it first among T3's themes", () => {
    expect(themeSettings).toMatch(
      /const MAINTAINER_THEMES: ReadonlyArray<ThemeDefinition> = \[\s*STEMCELLS_THEME,/,
    );
  });
});
