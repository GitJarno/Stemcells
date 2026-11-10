// Lab rig, evaluated in the lab page: records what the page's main thread sees of a swipe.
(() => {
  if (window.__lab) {
    window.__lab.stop();
  }
  const lab = (window.__lab = {
    wheels: [],
    phases: [],
    frames: [],
    long: [],
    heard: [],
    on: true,
  });
  const onWheel = (e) => {
    if (lab.on)
      lab.wheels.push([
        e.timeStamp,
        performance.now(),
        e.deltaX,
        e.deltaY,
        e.cancelable ? 1 : 0,
        e.defaultPrevented ? 1 : 0,
      ]);
  };
  window.addEventListener("wheel", onWheel, { capture: true, passive: true });
  const unphase = window.stemcellsScrollPhases?.subscribe((s) => {
    if (lab.on) lab.phases.push([s.t, performance.now(), s.phase, s.momentum, s.moved ? 1 : 0]);
  });
  // What the page hears of the pager's proxy, in the order it hears it: its scroll, where it
  // will snap to, its rest, the knots and the strip's own place as they are written.
  const proxy = document.querySelector("[data-stemcells-pages]");
  const hear = (kind, value) => lab.on && lab.heard.push([performance.now(), kind, value]);
  const slotOf = () => proxy.scrollLeft / (proxy.scrollWidth / 41);
  const onScroll = () => hear("scroll", Math.round(slotOf() * 1000) / 1000);
  const onEnd = () => hear("end", Math.round(slotOf() * 1000) / 1000);
  const onAim = (e) =>
    hear("aim", Number(e.snapTargetInline?.getAttribute("data-stemcells-proxy-slot")));
  proxy?.addEventListener("scroll", onScroll, { capture: true, passive: true });
  proxy?.addEventListener("scrollend", onEnd, { capture: true });
  proxy?.addEventListener("scrollsnapchanging", onAim, { capture: true });
  const writes = new MutationObserver((records) => {
    for (const record of records) {
      const el = record.target;
      if (el.hasAttribute("data-stemcells-hold")) hear("knots", el.getAttribute("data-knots"));
      else if (el.hasAttribute("data-stemcells-strip")) hear("strip", el.style.transform);
      else if (el === proxy) hear("moving", proxy.hasAttribute("data-moving"));
      else if (el.getAttribute("data-on-stage") === "true")
        hear("turn", el.getAttribute("data-stemcells-page"));
    }
  });
  // Each on its own, not the subtree: a chat streaming on a page writes styles all the time.
  const hold = proxy?.querySelector("[data-stemcells-hold]");
  const strip = proxy?.querySelector("[data-stemcells-strip]");
  proxy && writes.observe(proxy, { attributes: true, attributeFilter: ["data-moving"] });
  hold && writes.observe(hold, { attributes: true, attributeFilter: ["data-knots"] });
  strip && writes.observe(strip, { attributes: true, attributeFilter: ["style"] });
  // The tab turning: its page comes on stage.
  const stage = { attributes: true, subtree: true, attributeFilter: ["data-on-stage"] };
  strip && writes.observe(strip, stage);
  // Where the main thread has the strip, in pages.
  lab.position = () => {
    const pages = document.querySelector("[data-stemcells-pages]");
    const strip = document.querySelector("[data-stemcells-strip]");
    if (!pages || !strip) return null;
    const width = strip.clientWidth;
    const moved = (element) => {
      const t = element ? getComputedStyle(element).transform : "none";
      return t === "none" ? 0 : new DOMMatrixReadOnly(t).m41;
    };
    // The strip's own place, and with it what the hold round it adds as it follows the proxy.
    return -(moved(strip) + moved(strip.closest("[data-stemcells-hold]"))) / width;
  };
  let raf = 0;
  const loop = (t) => {
    raf = requestAnimationFrame(loop);
    if (!lab.on) return;
    const pages = document.querySelector("[data-stemcells-pages]");
    lab.frames.push([
      t,
      performance.now(),
      lab.position(),
      pages?.hasAttribute("data-moving") ? 1 : 0,
    ]);
  };
  raf = requestAnimationFrame(loop);
  let observer;
  try {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        lab.long.push([entry.startTime, entry.duration, entry.blockingDuration ?? 0]);
    });
    observer.observe({ type: "long-animation-frame", buffered: false });
  } catch {}
  lab.reset = () => {
    lab.wheels = [];
    lab.phases = [];
    lab.frames = [];
    lab.long = [];
    lab.heard = [];
  };
  lab.stop = () => {
    window.removeEventListener("wheel", onWheel, { capture: true });
    proxy?.removeEventListener("scroll", onScroll, { capture: true });
    proxy?.removeEventListener("scrollend", onEnd, { capture: true });
    proxy?.removeEventListener("scrollsnapchanging", onAim, { capture: true });
    writes.disconnect();
    unphase?.();
    cancelAnimationFrame(raf);
    observer?.disconnect();
    clearInterval(lab.holder);
  };
  // The page's clock against the system's, for lining the rig's events up: performance.timeOrigin is wall-clock ms.
  lab.clock = () => ({ origin: performance.timeOrigin, now: performance.now(), wall: Date.now() });
  // A main thread held `ms` every `every` ms (0 stops it).
  lab.hold = (ms, every) => {
    clearInterval(lab.holder);
    if (!ms) return;
    lab.holder = setInterval(() => {
      const until = performance.now() + ms;
      while (performance.now() < until) {}
    }, every);
  };
  // Which tab is on stage, and the tabs in order.
  lab.state = async () => {
    const m = await import("/src/stemcells/tabs/store.ts");
    const w = m.readWorkspace();
    const pages = document.querySelector("[data-stemcells-pages]");
    return {
      active: w.activeTabId,
      index: w.tabs.findIndex((t) => t.id === w.activeTabId),
      count: w.tabs.length,
      moving: pages?.hasAttribute("data-moving") ?? false,
      position: lab.position(),
      onStage: [...document.querySelectorAll("[data-stemcells-page][data-on-stage=true]")].map(
        (p) => p.dataset.stemcellsPage,
      ),
      mounted: document.querySelectorAll("[data-stemcells-page]").length,
    };
  };
  return "probe on";
})();
