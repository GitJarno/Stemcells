// Lab rig, evaluated in the page: what a tab turn costs, as the page's main thread sees it.
(() => {
  window.__turns?.stop();
  const t = (window.__turns = { marks: [], frames: [], long: [], events: [], on: true });
  const mark = (kind, value) => t.on && t.marks.push([performance.now(), kind, value]);
  const input = (e) => mark("input:" + e.type, e.timeStamp);
  for (const type of ["pointerdown", "pointerup", "keydown"])
    window.addEventListener(type, input, { capture: true, passive: true });
  const focus = (e) =>
    mark(
      "focus",
      e.target?.closest?.("[data-stemcells-page]")?.getAttribute("data-stemcells-page") ?? null,
    );
  window.addEventListener("focusin", focus, { capture: true, passive: true });
  const writes = new MutationObserver((records) => {
    for (const r of records) {
      const el = r.target;
      if (r.attributeName === "aria-selected") {
        if (el.getAttribute("aria-selected") === "true")
          mark("lit", el.getAttribute("data-stemcells-tab"));
      } else if (r.attributeName === "data-on-stage") {
        if (el.getAttribute("data-on-stage") === "true")
          mark("stage", el.getAttribute("data-stemcells-page"));
      } else if (r.attributeName === "data-moving") mark("moving", el.hasAttribute("data-moving"));
      else if (r.type === "childList" && el.hasAttribute?.("data-stemcells-strip"))
        mark("pages", el.children.length);
      else if (r.type === "childList" && r.addedNodes.length > 20)
        mark("grew", r.addedNodes.length);
    }
  });
  const observe = () => {
    writes.disconnect();
    const strip = document.querySelector("[data-stemcells-pages] [data-stemcells-strip]");
    const pages = document.querySelector("[data-stemcells-pages]");
    const tabs = document.querySelector("[data-stemcells-tab-strip]");
    pages && writes.observe(pages, { attributes: true, attributeFilter: ["data-moving"] });
    strip &&
      writes.observe(strip, {
        attributes: true,
        subtree: true,
        childList: true,
        attributeFilter: ["data-on-stage"],
      });
    tabs &&
      writes.observe(tabs, { attributes: true, subtree: true, attributeFilter: ["aria-selected"] });
  };
  observe();
  t.position = () => {
    const strip = document.querySelector("[data-stemcells-pages] [data-stemcells-strip]");
    if (!strip) return null;
    const moved = (el) => {
      const s = el ? getComputedStyle(el).transform : "none";
      return s === "none" ? 0 : new DOMMatrixReadOnly(s).m41;
    };
    return -(moved(strip) + moved(strip.closest("[data-stemcells-hold]"))) / strip.clientWidth;
  };
  let raf = 0;
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    if (t.on && t.sample) t.frames.push([now, t.position()]);
  };
  raf = requestAnimationFrame(loop);
  const observers = [];
  const watch = (type, key, pick, extra = {}) => {
    try {
      const o = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) t.on && t[key].push(pick(e));
      });
      o.observe({ type, buffered: false, ...extra });
      observers.push(o);
    } catch {}
  };
  watch("long-animation-frame", "long", (e) => [
    e.startTime,
    e.duration,
    e.blockingDuration ?? 0,
    e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0,
    (e.scripts ?? []).reduce((a, s) => a + s.duration, 0),
    (e.scripts ?? []).reduce((a, s) => a + (s.forcedStyleAndLayoutDuration ?? 0), 0),
  ]);
  watch(
    "event",
    "events",
    (e) => [e.name, e.startTime, e.processingStart, e.processingEnd, e.duration],
    { durationThreshold: 16 },
  );
  t.reset = () => {
    t.marks = [];
    t.frames = [];
    t.long = [];
    t.events = [];
    observe();
  };
  t.stop = () => {
    window.removeEventListener("focusin", focus, { capture: true });
    writes.disconnect();
    cancelAnimationFrame(raf);
    for (const o of observers) o.disconnect();
    for (const type of ["pointerdown", "pointerup", "keydown"])
      window.removeEventListener(type, input, { capture: true });
  };
  t.state = () => ({
    lit:
      document
        .querySelector('[data-stemcells-tab][aria-selected="true"]')
        ?.getAttribute("data-stemcells-tab") ?? null,
    stage: [...document.querySelectorAll('[data-stemcells-page][data-on-stage="true"]')].map(
      (p) => p.dataset.stemcellsPage,
    ),
    mounted: [...document.querySelectorAll("[data-stemcells-pages] [data-stemcells-page]")].map(
      (p) => p.dataset.stemcellsPage,
    ),
    moving: document.querySelector("[data-stemcells-pages]")?.hasAttribute("data-moving") ?? false,
    position: t.position(),
    rows: document.querySelectorAll(
      "[data-stemcells-pane] [data-chat-canvas] [data-index], [data-stemcells-pane] [data-chat-canvas] [role=listitem]",
    ).length,
    nodes: document.getElementsByTagName("*").length,
    heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null,
  });
  return "probe on";
})();
