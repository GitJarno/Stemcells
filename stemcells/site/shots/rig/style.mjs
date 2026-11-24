// style.mjs: the app's look as the browser computes it, for NOTES.md: colours as sRGB hex,
// radii, type. shoot.mjs writes it to $OUT/style.json at the crew moment (an ask open).
//   node style.mjs      the same probe by hand, printed (needs that moment: after `shoot.mjs flying input`)
import { cells, isMain, layout, open, sleep, tab } from "./lib.mjs";

export function look(page) {
  return page.evaluate(() => {
    const seen = (el) => {
      const r = el.getBoundingClientRect();
      return (
        r.width > 1 && r.height > 1 && r.x >= 0 && r.x < innerWidth && r.y >= 0 && r.y < innerHeight
      );
    };
    const first = (selector, root = document) => [...root.querySelectorAll(selector)].find(seen);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ink = canvas.getContext("2d", { willReadFrequently: true });
    /** Any CSS colour as the sRGB hex the screen gets, with its alpha when it has one. */
    const hex = (color) => {
      ink.clearRect(0, 0, 1, 1);
      ink.fillStyle = color;
      ink.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ink.getImageData(0, 0, 1, 1).data;
      if (a === 0) return "transparent";
      const rgb = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
      return a < 255 ? `${rgb} at ${(a / 255).toFixed(2)}` : rgb;
    };
    const pick = (el, ...props) => {
      if (!el) return null;
      const style = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const out = { box: `${Math.round(r.width)}x${Math.round(r.height)}` };
      for (const prop of props) {
        const value = style.getPropertyValue(prop);
        out[prop] = prop.endsWith("color") ? hex(value) : value;
      }
      return out;
    };
    const text = [
      "font-family",
      "font-size",
      "font-weight",
      "line-height",
      "letter-spacing",
      "color",
    ];
    const surface = [
      "background-color",
      "border-top-color",
      "border-top-width",
      "border-radius",
      "box-shadow",
    ];
    const column = first("[data-stemcells-cells][data-stemcells-proxy]");
    const stageRow = (stage) => column.querySelector(`button[data-cells-stage="${stage}"]`);
    const dotOf = (row) => {
      const mark = getComputedStyle(row.querySelector("[data-cells-stage-mark]"), "::before");
      return { colour: hex(mark.backgroundColor), size: mark.width, radius: mark.borderRadius };
    };
    const pane = first("[data-stemcells-pane]");
    const says = (words) =>
      [...pane.querySelectorAll("p, div, span")].find(
        (el) => seen(el) && el.children.length === 0 && el.innerText?.trim().startsWith(words),
      );
    const paragraph = says("It fails 5 runs");
    /** The nearest box around `el` that paints a surface of its own. */
    const surfaceOf = (el) => {
      for (let at = el; at && at !== pane; at = at.parentElement)
        if (getComputedStyle(at).backgroundColor !== "rgba(0, 0, 0, 0)") return at;
      return null;
    };
    const bubble = surfaceOf(says("The cart test fails"));
    const glass = first("[data-stemcells-composer-glass]");
    const need = first("[data-stemcells-need]", column);
    const stages = {};
    for (const [word, stage] of [
      ["Input", "needs"],
      ["Flying", "working"],
      ["Landed", "landed"],
      ["Settled", "settled"],
    ]) {
      const row = stageRow(stage);
      stages[word] = {
        dot: dotOf(row),
        open: row.getAttribute("data-open"),
        row: pick(row, ...text, "background-color", "border-radius", "padding"),
        count: pick(
          row.querySelector("[data-cells-stage-count]"),
          "color",
          "font-size",
          "font-variant-numeric",
        ),
      };
    }
    const bars = [...document.querySelectorAll("[data-stemcells-chart-bar]")].filter(seen);
    const root = getComputedStyle(document.documentElement);
    const tokens = {};
    for (const name of [
      "--background",
      "--foreground",
      "--card",
      "--border",
      "--muted",
      "--muted-foreground",
      "--primary",
      "--accent",
      "--radius",
      "--font-sans",
      "--font-mono",
    ]) {
      const value = root.getPropertyValue(name).trim();
      tokens[name] = /^(oklch|rgb|#|color)/.test(value) ? `${hex(value)} (${value})` : value;
    }
    return {
      tokens,
      html: pick(
        document.documentElement,
        "background-color",
        "color-scheme",
        "font-family",
        "font-size",
      ),
      body: pick(document.body, "background-color", ...text),
      workspace: pick(first("[data-stemcells-workspace]"), ...surface),
      slate: pick(first("[data-stemcells-slate]"), ...surface, "overflow"),
      pane: pick(pane, ...surface),
      split: pick(first("[data-stemcells-split]"), "background-color", "width"),
      column: pick(column, ...surface, ...text),
      stages,
      askCard: pick(need, ...surface, "padding"),
      askQuestion: pick(
        need &&
          [...need.querySelectorAll("*")].find(
            (el) =>
              seen(el) &&
              el.children.length === 0 &&
              el.innerText?.includes("Follow the system, or"),
          ),
        ...text,
      ),
      askOption: pick(
        need && [...need.querySelectorAll("button, [role=button]")].find(seen),
        ...surface,
        ...text,
        "padding",
      ),
      tabStrip: pick(first("[data-stemcells-tab-strip]"), "background-color", "height"),
      tabOpen: pick(first("[data-stemcells-tab]"), ...surface, ...text),
      reply: pick(paragraph, ...text),
      userBubble: pick(bubble, ...surface, ...text, "padding"),
      slateCorners: (() => {
        const before = getComputedStyle(first("[data-stemcells-slate]"), "::before");
        return {
          radius: before.borderRadius,
          border: `${before.borderTopWidth} ${hex(before.borderTopColor)}`,
          shadow: before.boxShadow,
        };
      })(),
      grain: getComputedStyle(first("[data-stemcells-workspace]")).backgroundImage.slice(0, 60),
      previewBox: pick(first("[data-option-preview]", column), ...surface, "padding"),
      previewText: pick(first("[data-option-preview-pane]", column), ...text),
      composerGlass: pick(glass, ...surface, "background-image", "backdrop-filter"),
      composerInner: pick(
        glass &&
          [...glass.querySelectorAll("*")].find(
            (el) =>
              seen(el) &&
              getComputedStyle(el).backgroundColor !== "rgba(0, 0, 0, 0)" &&
              el.getBoundingClientRect().width > 300,
          ),
        ...surface,
        "background-image",
      ),
      composerLine: pick(first("[data-stemcells-composer-line]"), ...surface, ...text),
      closeOut: pick(first("[data-stemcells-close-out]"), ...surface, "padding"),
      closeOutLegend: pick(first("[data-stemcells-close-out] legend"), ...text),
      chartTitle: pick(first("[data-stemcells-chart-title]"), ...text),
      chartBars: bars
        .slice(0, 2)
        .map((bar) => pick(bar, "background-color", "border-radius", "height")),
      chartTrack: pick(first("[data-stemcells-chart-track]"), "background-color", "height"),
    };
  });
}

if (isMain(import.meta.url)) {
  const c = cells();
  const { context, page } = await open();
  try {
    await layout(page, {
      tabs: [
        tab("crew", [[c.flaky.threadId, c.search.threadId]]),
        tab("crew-dark", [[c.dark.threadId]]),
      ],
      stage: "needs",
    });
    await page.waitForSelector("[data-stemcells-close-out]", { state: "attached", timeout: 60000 });
    await sleep(3000);
    console.log(JSON.stringify(await look(page), null, 2));
  } finally {
    await context.close();
  }
}
