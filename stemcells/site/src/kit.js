// Aski's body, eyes and the character grid: shared by every stage on the page.
// oxlint-disable-next-line no-unused-vars -- hero.js and story.js read it; they load after this file.
const kit = (() => {
  "use strict";
  // ── Math ────────────────────────────────────────────────────────
  const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const unlerp = (a, b, x) => clamp((x - a) / (b - a), 0, 1);
  /** 0 before a, 1 after b, and a smooth step between. */
  const sstep = (a, b, x) => {
    const t = unlerp(a, b, x);
    return t * t * (3 - 2 * t);
  };
  const curves = {
    linear: (t) => t,
    inCubic: (t) => t * t * t,
    outCubic: (t) => 1 - (1 - t) ** 3,
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
    outBack: (t) => {
      const c = 1.9;
      return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
    },
  };
  /** The house curve, the koi's pace: ease(t) is ease.inOutCubic(t). */
  const ease = Object.freeze(Object.assign((t) => curves.inOutCubic(t), curves));
  /** A bump that rises over inDur, holds, and falls over outDur inside [0, dur]. */
  function envelope(t, dur, inDur, outDur, curve = curves.inOutCubic) {
    if (t <= 0 || t >= dur) return 0;
    if (t < inDur) return curve(t / inDur);
    if (t > dur - outDur) return curve((dur - t) / outDur);
    return 1;
  }
  /** Integer hash to [0, 1): same inputs, same output, on every machine. */
  function hash(seed, a, b = 0, c = 0) {
    let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
    h = Math.imul(h ^ (a | 0), 0xc2b2ae35);
    h = Math.imul(h ^ (b | 0) ^ (h >>> 15), 0x27d4eb2f);
    h = Math.imul(h ^ (c | 0) ^ (h >>> 13), 0x165667b1);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // ── The body ───────────────────────────────────────────────────
  // Canon units: Aski stands about 224 tall, x grows right, y grows down, and
  // (0, 0) is the ground between its feet.
  const LOBES = Object.freeze(
    [
      { name: "crown", x: 8.8, y: -153.3, r: 68.6, k: 150, zeta: 0.3 },
      { name: "right", x: 67, y: -139.1, r: 50, k: 230, zeta: 0.36 },
      { name: "left", x: -62.9, y: -108.9, r: 54.9, k: 230, zeta: 0.36 },
      { name: "footL", x: -39.8, y: -55.7, r: 53.8, k: 560, zeta: 0.78 },
      { name: "footR", x: 49.7, y: -60.2, r: 60.9, k: 560, zeta: 0.78 },
    ].map(Object.freeze),
  );
  /** Where the two apostrophes sit (ink centres) and how tall they are. They ride the crown. */
  const EYES = Object.freeze({
    centers: Object.freeze([Object.freeze([6, -137]), Object.freeze([56, -142])]),
    height: 76,
  });
  /** True when canon point (x, y) is inside the body, `inset` units in from its edge. */
  const inBody = (x, y, inset = 0) =>
    LOBES.some((l) => (x - l.x) ** 2 + (y - l.y) ** 2 < (l.r - inset) ** 2);

  // ── The eye ──────────────────────────────────────────────────────
  // An apostrophe, as it is typeset: a round ball and a long thin tail that
  // curls down to a sharp tip. Drawn as Aski's own outline, so it is the same
  // on every machine; one unit tall, centred on its ink box.
  const APOSTROPHE = (() => {
    const pts = [],
      head = (a) => [Math.cos(a), Math.sin(a)];
    const a0 = (84 * Math.PI) / 180,
      a1 = 2 * Math.PI,
      ARC = 48,
      EDGE = 24;
    for (let i = 0; i <= ARC; i++) pts.push(head(a0 + ((a1 - a0) * i) / ARC));
    const cubic = (p0, c1, c2, p3) => {
      for (let i = 1; i <= EDGE; i++) {
        const t = i / EDGE,
          u = 1 - t;
        pts.push([
          u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0],
          u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1],
        ]);
      }
    };
    // The tail's outer edge leaves the ball on its right, the inner edge comes back to it low on the left.
    const tip = [-1.05, 3.05];
    cubic([1, 0], [1, 1.05], [0.3, 2.3], tip);
    cubic(tip, [-0.3, 2.4], [0.3, 1.5], head(a0));
    pts.pop(); // the last point closes onto the first
    let x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity;
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    const cx = (x0 + x1) / 2,
      cy = (y0 + y1) / 2,
      k = 1 / (y1 - y0);
    return Float64Array.from(pts.flatMap(([x, y]) => [(x - cx) * k, (y - cy) * k]));
  })();
  /** Adds one eye to c's current path: ink centre (x, y), h tall, open 1 (toward 0, a blink squashes it). */
  function eyePath(c, x, y, h, open = 1) {
    c.save();
    c.translate(x, y);
    c.scale(h, h * Math.max(open, 0.06));
    c.moveTo(APOSTROPHE[0], APOSTROPHE[1]);
    for (let i = 2; i < APOSTROPHE.length; i += 2) c.lineTo(APOSTROPHE[i], APOSTROPHE[i + 1]);
    c.closePath();
    c.restore();
  }

  // ── The cloud ─────────────────────────────────────────────────────────────
  /** Aski at rest, in canon units at c's current transform: five ink lobes, the eyes cut out of them. */
  function body(c, ink, open = 1) {
    c.beginPath();
    for (const { x, y, r } of LOBES) {
      c.moveTo(x + r, y);
      c.arc(x, y, r, 0, 7);
    }
    c.fillStyle = ink;
    c.fill();
    const was = c.globalCompositeOperation;
    c.globalCompositeOperation = "destination-out";
    c.beginPath();
    for (const [x, y] of EYES.centers) eyePath(c, x, y, EYES.height, open);
    c.fill();
    c.globalCompositeOperation = was;
  }
  function layer(c, w, h) {
    const dpr = devicePixelRatio || 1;
    c.width = Math.ceil(w * dpr);
    c.height = Math.ceil(h * dpr);
    const o = c.getContext("2d");
    o.setTransform(dpr, 0, 0, dpr, 0, 0);
    return o;
  }
  /** The cloud at scale s in layer c; returns its box relative to the feet. */
  function cloudLayer(c, s, ink, open = 1, sx = 1, sy = 1) {
    const w = Math.ceil(330 * s),
      h = Math.ceil(300 * s),
      o = layer(c, w, h);
    o.save();
    o.translate(w / 2, h - 2);
    o.scale(s * sx, s * sy);
    body(o, ink, open);
    o.restore();
    return { w, h, x: -w / 2, y: -h + 2 };
  }

  // ── The grid ──────────────────────────────────────────────────────────────
  const PRINTABLE =
    "!\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~";
  const CHARS = PRINTABLE + "█▓▒░▄▀━│■·";
  const MONO =
    'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
  /** Sizes canvas cv to its box and lays a character grid over it. One atlas row per ink. */
  function grid(cv, { font = 11, lh = 13, inks }) {
    const ctx = cv.getContext("2d");
    const dpr = Math.min(devicePixelRatio || 1, 2),
      W = cv.clientWidth,
      H = cv.clientHeight;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `${font}px ${MONO}`;
    const cw = ctx.measureText("M").width,
      cols = Math.floor(W / cw),
      rows = Math.floor(H / lh);
    const ox = (W - cols * cw) / 2,
      oy = (H - rows * lh) / 2,
      cwD = Math.ceil(cw * dpr),
      lhD = Math.round(lh * dpr);
    const atlas = document.createElement("canvas"),
      index = new Map(),
      chars = [...CHARS];
    atlas.width = cwD * chars.length;
    atlas.height = lhD * inks.length;
    const a = atlas.getContext("2d");
    a.font = `${font * dpr}px ${MONO}`;
    a.textAlign = "center";
    a.textBaseline = "middle";
    chars.forEach((c, k) => index.set(c, k));
    inks.forEach((ink, n) => {
      a.fillStyle = ink;
      chars.forEach((c, k) => {
        // Blocks fill their whole cell, so neighbours join into one body; density is life.
        const block = { "█": 1, "▓": 0.74, "▒": 0.48, "░": 0.24 }[c];
        if (block) {
          a.globalAlpha = block;
          a.fillRect(k * cwD, n * lhD, cwD, lhD);
          a.globalAlpha = 1;
          return;
        }
        a.fillText(c, k * cwD + cwD / 2, n * lhD + lhD / 2 + dpr * 0.5);
      });
    });
    // Blocks are painted as exact rects on device pixels, so a body has no seams.
    const BLOCK = {
      "█": [1, 0, 1],
      "▓": [0.74, 0, 1],
      "▒": [0.48, 0, 1],
      "░": [0.24, 0, 1],
      "▀": [1, 0, 0.5],
      "▄": [1, 0.5, 1],
    };
    const snap = (v) => Math.round(v * dpr) / dpr;
    function stamp(ch, al, x, y, n = 0) {
      if (al < 0.02 || ch === " ") return;
      const b = BLOCK[ch];
      if (b) {
        ctx.globalAlpha = Math.min(1, al) * b[0];
        ctx.fillStyle = inks[n];
        const x0 = snap(x),
          x1 = snap(x + cw),
          y0 = snap(y + lh * b[1]),
          y1 = snap(y + lh * b[2]);
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        return;
      }
      const k = index.get(ch);
      if (k === undefined) return;
      ctx.globalAlpha = al > 1 ? 1 : al;
      ctx.drawImage(atlas, k * cwD, n * lhD, cwD, lhD, x, y, cwD / dpr, lhD / dpr);
    }
    const glyph = (ch, al, i, j, n = 0) => {
      if (i >= 0 && i < cols && j >= 0 && j < rows) stamp(ch, al, ox + i * cw, oy + j * lh, n);
    };
    return {
      ctx,
      W,
      H,
      dpr,
      cw,
      lh,
      cols,
      rows,
      ox,
      oy,
      glyph,
      stamp,
      x: (i) => ox + (i + 0.5) * cw,
      y: (j) => oy + (j + 0.5) * lh,
      i: (x) => Math.round((x - ox) / cw - 0.5),
      j: (y) => Math.round((y - oy) / lh - 0.5),
    };
  }

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** One line typed unhurried into el. */
  function sayBox(el, { every = 34, delay = 200 } = {}) {
    let timer = 0;
    return {
      type(text) {
        clearTimeout(timer);
        el.textContent = "";
        el.classList.add("on");
        if (reduce) {
          el.textContent = text;
          return;
        }
        let n = 0;
        const tick = () => {
          el.textContent = text.slice(0, ++n);
          if (n < text.length) timer = setTimeout(tick, every);
        };
        timer = setTimeout(tick, delay);
      },
      hide() {
        clearTimeout(timer);
        el.classList.remove("on");
      },
    };
  }

  /** Runs draw(now) on every frame while `live()` says so and the stage is on screen. */
  function loop(el, draw) {
    let raf = 0,
      seen = false,
      want = false;
    const tick = (now) => {
      raf = 0;
      if (!seen) return;
      want = draw(now / 1000) === true;
      if (want) raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!raf && seen) raf = requestAnimationFrame(tick);
    };
    new IntersectionObserver(
      ([e]) => {
        seen = e.isIntersecting;
        if (seen) kick();
      },
      { rootMargin: "80px" },
    ).observe(el);
    return { kick };
  }

  return Object.freeze({
    clamp,
    lerp,
    unlerp,
    sstep,
    ease,
    envelope,
    hash,
    LOBES,
    EYES,
    inBody,
    APOSTROPHE,
    eyePath,
    body,
    layer,
    cloudLayer,
    PRINTABLE,
    grid,
    reduce,
    sayBox,
    loop,
  });
})();
