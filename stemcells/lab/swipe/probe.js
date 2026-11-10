// Lab rig, evaluated in the lab page: records what the page's main thread sees of a swipe.
(() => {
  if (window.__lab) {
    window.__lab.stop();
  }
  const lab = (window.__lab = { wheels: [], phases: [], frames: [], long: [], on: true });
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
  // Where the main thread has the strip: the old strip's transform, or a scroller's offset.
  lab.position = () => {
    const pages = document.querySelector("[data-stemcells-pages]");
    const strip = document.querySelector("[data-stemcells-strip]");
    if (!pages || !strip) return null;
    const width = pages.clientWidth;
    if (pages.hasAttribute("data-lab-scroller") || strip.style.transform === "") {
      return Number(pages.dataset.labBase ?? 0) + pages.scrollLeft / width;
    }
    const t = getComputedStyle(strip).transform;
    return t === "none" ? 0 : -new DOMMatrixReadOnly(t).m41 / width;
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
  };
  lab.stop = () => {
    window.removeEventListener("wheel", onWheel, { capture: true });
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
