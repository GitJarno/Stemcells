// The hero. It opens on a pond with a koi in it; the pond gathers into Aski,
// who rests as the cloud. Click Aski and it becomes something else, out of
// its own letters, then comes home.
(() => {
  "use strict";
  const { clamp, lerp, sstep, ease, hash, inBody, eyePath, cloudLayer, PRINTABLE, reduce } = kit;
  const $ = (s) => document.querySelector(s);
  const stage = $("#hero"),
    cv = $("#hero-cv"),
    sayEl = $("#hero-say"),
    hintEl = $("#hero-hint");
  const say = kit.sayBox(sayEl);

  // Ink 0 is Aski's; any other colour is the thing's own.
  const INK = "#EDE9E0";
  const COLORS = [
    INK,
    "#E6AE48",
    "#E5534B",
    "#F08A3C",
    "#F2C94C",
    "#6CC489",
    "#5B8DEF",
    "#A37BE8",
    "#C9955B",
    "#E3D6B6",
  ];
  const C = {
    ink: 0,
    gold: 1,
    red: 2,
    orange: 3,
    yellow: 4,
    green: 5,
    blue: 6,
    violet: 7,
    leather: 8,
    rope: 9,
  };

  // ── Layout ─────────────────────────────────────────────────────────────────
  let G,
    W,
    H,
    cw,
    lh,
    cols,
    rows,
    mobile,
    cx,
    gy,
    s,
    box,
    holes = [];
  function setup() {
    const w = stage.clientWidth;
    mobile = w < 760;
    const font = mobile ? 8 : clamp(Math.round(w / 150), 9, 12);
    G = kit.grid(cv, { font, lh: Math.round(font * 1.22), inks: COLORS });
    ({ W, H, cw, lh, cols, rows } = G);
    // Aski and its forms live beside the words (below them on a phone), never under them.
    const b = cv.getBoundingClientRect(),
      copy = stage.querySelector(".hero-copy").getBoundingClientRect();
    holes = [...stage.querySelectorAll(".hole")].map((el) => {
      const r = el.getBoundingClientRect();
      return [r.left - b.left - 14, r.top - b.top - 8, r.right - b.left + 14, r.bottom - b.top + 8];
    });
    if (mobile) {
      const top = 70,
        bottom = copy.top - b.top - 54;
      box = { x: W / 2, y: (top + bottom) / 2, w: W * 0.94, h: bottom - top };
      s = Math.min(box.h * 0.8, (W * 0.6 * 224) / 260) / 224;
      cx = W / 2;
      gy = bottom - 6;
    } else {
      const left = Math.max(copy.right - b.left + 40, ...holes.map((h) => h[2] + 28), W * 0.4),
        right = W * 0.97,
        top = 72,
        bottom = H - 92;
      box = { x: (left + right) / 2, y: (top + bottom) / 2, w: right - left, h: bottom - top };
      s = Math.min((H * 0.42) / 224, (box.w * 0.78) / 260);
      cx = box.x;
      gy = H * 0.78;
    }
    HOME = homeCells();
    FORMS.forEach((f) => {
      f.cells = null;
    });
    occ = new Uint8Array(cols * rows);
    mark(HOME);
    placeSay();
  }
  const inHole = (x, y) => holes.some(([a, b, c, d]) => x > a && x < c && y > b && y < d);

  // ── Aski at home ───────────────────────────────────────────────────────────
  const CLOUD_EYES = kit.EYES.centers.map(([x, y]) => [x, y, kit.EYES.height]);
  const cloudEyes = () =>
    CLOUD_EYES.map(([x, y, h]) => ({ x: cx + x * s, y: gy + y * s, h: h * s }));
  let HOME = [];
  function homeCells() {
    const out = [];
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const x = G.x(i),
          y = G.y(j),
          u = (x - cx) / s,
          v = (y - gy) / s;
        if (!inBody(u, v, 2)) continue;
        out.push({ x, y, ch: PRINTABLE[(hash(7, i, j) * PRINTABLE.length) | 0], al: 0.92, ink: 0 });
      }
    return out;
  }
  const off = document.createElement("canvas");
  function drawCloud(al, open) {
    if (al < 0.01) return;
    const b = cloudLayer(off, s, INK, open);
    G.ctx.globalAlpha = al;
    G.ctx.drawImage(off, cx + b.x, gy + b.y, b.w, b.h);
    G.ctx.globalAlpha = 1;
  }

  // ── The pond and the koi ──────────────────────────────────────────────────
  const T = { koi: 0, gather: reduce ? 0 : 7.4 };
  const LAP = 12;
  let KL, KW, pcx, pcy, prx, pry;
  function pondLayout() {
    KL = clamp(Math.min(W, H * 1.6) * 0.2, 130, 290);
    KW = KL * 0.13;
    pcx = box.x;
    pcy = box.y;
    prx = box.w * (mobile ? 0.3 : 0.36);
    pry = box.h * 0.3;
  }
  function path(tq) {
    const th = ((tq + 2.2) / LAP) * Math.PI * 2;
    return [pcx + prx * Math.sin(th), pcy + pry * Math.sin(2 * th)];
  }
  function spine(t) {
    const pts = [path(t)];
    let tt = t;
    for (let k = 1; k <= 18; k++) {
      const q = pts[k - 1];
      let step = 0.05;
      for (let n = 0; n < 6; n++) {
        const p = path(tt - step);
        const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
        if (d > 0) step = clamp((step * (KL / 18)) / d, 0.002, 0.4);
      }
      tt -= step;
      pts.push(path(tt));
    }
    return pts.map((p, k) => {
      if (k === 0) return p;
      const a = pts[k - 1],
        dx = a[0] - p[0],
        dy = a[1] - p[1],
        l = Math.hypot(dx, dy) || 1;
      const w = Math.sin(t * 7.5 - k * 0.42) * KW * 0.24 * (k / 18) ** 1.6;
      return [p[0] - (dy / l) * w, p[1] + (dx / l) * w];
    });
  }
  const rayChar = (a) => {
    a = ((a % Math.PI) + Math.PI) % Math.PI;
    return a < 0.39 || a > 2.75 ? "-" : a < 1.18 ? "\\" : a < 1.96 ? "|" : "/";
  };
  function koiAt(x, y, S, t) {
    let best = 1e9,
      along = 0,
      side = 0,
      head = 0;
    for (let k = 0; k < S.length - 1; k++) {
      const [ax, ay] = S[k],
        [bx, by] = S[k + 1],
        dx = bx - ax,
        dy = by - ay,
        l2 = dx * dx + dy * dy || 1;
      const u = clamp(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1),
        px = ax + u * dx,
        py = ay + u * dy,
        d = Math.hypot(x - px, y - py);
      if (d < best) {
        best = d;
        along = (k + u) / (S.length - 1);
        side = (x - px) * dy - (y - py) * dx < 0 ? -1 : 1;
        head = Math.atan2(-dy, -dx);
      }
    }
    const sn = along;
    let w =
      sn < 0.14
        ? Math.sqrt(sn / 0.14) * 0.82 + 0.1
        : sn < 0.4
          ? lerp(0.92, 1, (sn - 0.14) / 0.26)
          : sn < 0.82
            ? lerp(1, 0.2, (sn - 0.4) / 0.42)
            : 0.2;
    w *= KW;
    const pec =
      sn > 0.18 && sn < 0.3 && best > w * 0.9 && best < w * lerp(1.55, 1.05, (sn - 0.18) / 0.12);
    const tf = (sn - 0.82) / 0.18,
      tail =
        sn >= 0.82 &&
        best < KW * lerp(0.22, 0.78, tf) &&
        !(tf > 0.65 && best < KW * (tf - 0.65) * 1.2);
    if (best > w && !pec && !tail) return null;
    if (pec)
      return hash(3, Math.round(x), Math.round(y)) < 0.45
        ? { ch: rayChar(head + side * 2.3), edge: true }
        : null;
    if (tail)
      return hash(4, Math.round(x), Math.round(y)) < 0.5
        ? { ch: rayChar(head + ((side * best) / KW) * 0.9 + Math.sin(t * 7) * 0.2), edge: true }
        : null;
    const r = best / w,
      n = Math.floor(sn * 40) % 3;
    return { ch: r < 0.55 ? "KOI"[n] : r < 0.9 ? "koi"[n] : "+" };
  }
  function koiEyes(t) {
    const S = spine(t),
      [hx, hy] = S[0],
      [nx, ny] = S[2],
      l = Math.hypot(hx - nx, hy - ny) || 1,
      ux = (hx - nx) / l,
      uy = (hy - ny) / l;
    const bx = hx - ux * KL * 0.07,
      by = hy - uy * KL * 0.07,
      w = KW * 0.5;
    return [
      { x: bx - uy * w, y: by + ux * w, h: lh * 1.5 },
      { x: bx + uy * w, y: by - ux * w, h: lh * 1.5 },
    ].sort((a, b) => a.x - b.x);
  }
  let rings = [],
    lastRing = -1;
  function water(t, x, y) {
    const band = Math.sin(
      y * 0.1 + 2.4 * Math.sin(x * 0.0055 + t * 0.32) + 0.9 * Math.sin(x * 0.016 - t * 0.55),
    );
    const drift =
      0.5 +
      0.5 * Math.sin(x * 0.0042 - y * 0.009 + t * 0.25) * Math.sin(x * 0.011 + y * 0.004 - t * 0.4);
    let v = (Math.max(0, band - 0.55) / 0.45) * drift,
      ch = null;
    for (const r of rings) {
      const age = t - r.t0;
      if (age < 0 || age > 3.2) continue;
      const dx = x - r.x,
        dy = (y - r.y) * 1.8,
        d = Math.hypot(dx, dy),
        front = age * 92;
      const h = r.amp * 1.5 * Math.exp(-(((d - front) / 8) ** 2)) * Math.exp(-age / 1.25);
      if (h > v) {
        v = h;
        const c = Math.abs(dx) / (d || 1);
        ch = c > 0.82 ? (dx < 0 ? "(" : ")") : c > 0.45 ? (dx * dy < 0 ? "/" : "\\") : "~";
      }
    }
    return [v, ch];
  }
  let pads = [];
  function padAt(x, y) {
    for (const p of pads) {
      const dx = x - p.x,
        dy = (y - p.y) * 1.7,
        d = Math.hypot(dx, dy);
      if (d > p.r) continue;
      let a = Math.atan2(dy, dx) - p.n;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      if (Math.abs(a) < 0.32 && d > p.r * 0.25) return null;
      if (d > p.r - 6) {
        const an = Math.atan2(dy, dx);
        return Math.abs(an) < 0.6 ? ")" : Math.abs(an) > 2.5 ? "(" : an > 0 ? "_" : "-";
      }
      return hash(5, Math.round(x), Math.round(y)) < 0.35 ? ":" : ".";
    }
    return undefined;
  }
  // Draws the pond at t; with `keep`, also returns every glyph it drew.
  function drawPond(t, eyes, keep) {
    const out = keep ? [] : null;
    const put = (ch, al, i, j, ink, koi) => {
      G.glyph(ch, al, i, j, ink);
      if (out && al > 0.05) out.push({ x: G.x(i), y: G.y(j), ch, al, ink, koi });
    };
    const fade = sstep(0, 1.2, t),
      depth = 1 - sstep(0.4, 2, t);
    if (depth < 0.6 && t - lastRing > 0.55) {
      lastRing = t;
      const S = spine(t),
        q = S[S.length - 1];
      rings.push({ x: q[0], y: q[1], t0: t, amp: 0.32 });
    }
    rings = rings.filter((r) => t - r.t0 < 3.4);
    const S = spine(t);
    let kx0 = 1e9,
      kx1 = -1e9,
      ky0 = 1e9,
      ky1 = -1e9;
    for (const [x, y] of S) {
      kx0 = Math.min(kx0, x);
      kx1 = Math.max(kx1, x);
      ky0 = Math.min(ky0, y);
      ky1 = Math.max(ky1, y);
    }
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const x = G.x(i),
          y = G.y(j);
        if (inHole(x, y) || nearEye(eyes, x, y)) continue;
        if (x > kx0 - 30 && x < kx1 + 30 && y > ky0 - 30 && y < ky1 + 30) {
          const k = koiAt(x, y, S, t);
          if (k) {
            if (depth > 0.55) {
              if (hash(6, i, j) < 0.35) put(".", 0.25 * (1 - depth) * fade, i, j, C.gold, true);
            } else
              put(
                depth > 0.3 ? (k.edge ? "." : "*") : k.ch,
                (1 - depth) * (k.edge ? 0.7 : 1) * fade,
                i,
                j,
                C.gold,
                true,
              );
            if (depth < 0.3) continue;
          }
        }
        const pad = padAt(x, y);
        if (pad !== undefined && pad !== null) {
          put(pad, 0.5 * fade, i, j, 0, false);
          continue;
        }
        const [a, rc] = water(t, x, y);
        if (a < 0.18) continue;
        if (!rc && a < 0.5 && hash(8, i, j) < 0.55) continue;
        const ch =
          rc || (a > 0.85 ? "~" : a > 0.55 ? "pond"[(i + j * 3) % 4] : a > 0.35 ? "-" : ".");
        put(ch, (0.16 + 0.4 * clamp(a, 0, 1.2)) * fade, i, j, 0, false);
      }
    return out;
  }

  // ── Forms ──────────────────────────────────────────────────────────────────
  // Each is spelled in its own name. An image form samples a public-domain
  // work; a drawn one paints layers into a mask, one word and ink per layer.
  const RAMP = " .`-:;=+";
  function cellsFrom(dens, PC, PR, i0, j0, pick) {
    const out = [];
    for (let pr = 0; pr < PR; pr++)
      for (let pc = 0; pc < PC; pc++) {
        const k = pr * PC + pc,
          d = dens[k];
        if (d < 0.14) continue;
        const i = i0 + pc,
          j = j0 + pr;
        if (i < 0 || j < 0 || i >= cols || j >= rows) continue;
        const [ch, ink] = pick(d, pc, pr, k);
        if (ch === " ") continue;
        out.push({
          x: G.x(i),
          y: G.y(j),
          ch,
          al: 0.22 + 0.78 * Math.pow(Math.min(d, 1), 0.8),
          ink,
        });
      }
    return out;
  }
  const spell = (word, d, pc, pr) => {
    const u = word.toUpperCase(),
      l = word.toLowerCase(),
      n = (pc + pr * 3) % word.length;
    return d > 0.66
      ? u[n]
      : d > 0.44
        ? l[n]
        : RAMP[Math.min(RAMP.length - 1, Math.floor((d / 0.44) * RAMP.length))];
  };
  const imgCache = {};
  function image(name) {
    if (!imgCache[name]) {
      const im = new Image();
      im.src = ART[name];
      imgCache[name] = im;
    }
    return imgCache[name];
  }
  function fit(aspect) {
    let pw = box.h * aspect,
      ph = box.h;
    if (pw > box.w) {
      pw = box.w;
      ph = pw / aspect;
    }
    const PC = Math.round(pw / cw),
      PR = Math.round(ph / lh);
    return { PC, PR, i0: G.i(box.x - pw / 2), j0: G.j(box.y - ph / 2), pw, ph };
  }
  function painting({ art, word, eyes, dark = false, lift = null }) {
    return () => {
      const im = image(art);
      if (!im.complete || !im.naturalWidth) return null;
      const f = fit(im.naturalWidth / im.naturalHeight),
        { PC, PR } = f;
      const c = document.createElement("canvas");
      c.width = PC;
      c.height = PR;
      const o = c.getContext("2d", { willReadFrequently: true });
      o.drawImage(im, 0, 0, PC, PR);
      const px = o.getImageData(0, 0, PC, PR).data,
        n = PC * PR,
        lum = new Float32Array(n);
      for (let k = 0; k < n; k++)
        lum[k] = (px[4 * k] * 0.3 + px[4 * k + 1] * 0.59 + px[4 * k + 2] * 0.11) / 255;
      // A dark subject on a pale ground (bronze in a gallery) is drawn by its darkness alone.
      if (dark) for (let k = 0; k < n; k++) lum[k] = sstep(0.34, 0.12, lum[k]);
      const sorted = Float32Array.from(lum).sort(),
        top = sorted[n - 1] || 1;
      const rank = (v) => {
        let lo = 0,
          hi = n;
        while (lo < hi) {
          const m = (lo + hi) >> 1;
          if (sorted[m] < v) lo = m + 1;
          else hi = m;
        }
        return lo / n;
      };
      const dens = new Float32Array(n);
      for (let k = 0; k < n; k++) {
        const pc = k % PC,
          pr = (k / PC) | 0,
          u = pc / PC - 0.5,
          v = pr / PR - 0.5;
        const edge = 1 - sstep(0.36, 0.52, Math.hypot(u, v * 0.9));
        const boost = lift ? lift(pc / PC, pr / PR) : 1;
        dens[k] =
          (dark ? lum[k] : Math.pow(0.55 * rank(lum[k]) + (0.45 * lum[k]) / top, 1.5)) *
          edge *
          boost;
      }
      return {
        cells: cellsFrom(dens, PC, PR, f.i0, f.j0, (d, pc, pr) => [spell(word, d, pc, pr), 0]),
        eyes: eyes.map(([u, v]) => ({
          x: G.x(f.i0) + u * f.pw,
          y: G.y(f.j0) + v * f.ph,
          h: f.ph * 0.055,
        })),
        bottom: G.y(f.j0) + f.ph,
      };
    };
  }
  // Layers draw in box pixels; each covers the ones before it.
  function drawn(layers, eyesAt) {
    return () => {
      const pw = box.w,
        ph = box.h,
        PC = Math.round(pw / cw),
        PR = Math.round(ph / lh);
      const i0 = G.i(box.x - pw / 2),
        j0 = G.j(box.y - ph / 2);
      const c = document.createElement("canvas");
      c.width = PC;
      c.height = PR;
      const o = c.getContext("2d", { willReadFrequently: true });
      const owner = new Int16Array(PC * PR).fill(-1),
        dens = new Float32Array(PC * PR);
      layers.forEach((L, n) => {
        o.setTransform(1, 0, 0, 1, 0, 0);
        o.clearRect(0, 0, PC, PR);
        o.setTransform(PC / pw, 0, 0, PR / ph, 0, 0);
        o.fillStyle = o.strokeStyle = "#fff";
        o.lineCap = o.lineJoin = "round";
        L.draw(o, pw, ph);
        const px = o.getImageData(0, 0, PC, PR).data;
        for (let k = 0; k < PC * PR; k++) {
          const a = px[4 * k + 3] / 255;
          if (a > 0.3) {
            owner[k] = n;
            dens[k] = a * (L.dens ?? 1);
          }
        }
      });
      return {
        cells: cellsFrom(dens, PC, PR, i0, j0, (d, pc, pr, k) => {
          const L = layers[owner[k]];
          return [L.ch ? L.ch(pc, pr, d) : spell(L.word, d, pc, pr), L.ink ?? 0];
        }),
        eyes: eyesAt(pw, ph).map(([x, y, h]) => ({ x: G.x(i0) + x, y: G.y(j0) + y, h })),
        bottom: G.y(j0) + ph,
      };
    };
  }
  const lobes = (o, fx, fy, k) => {
    o.beginPath();
    for (const L of kit.LOBES) {
      o.moveTo(fx + (L.x + L.r) * k, fy + L.y * k);
      o.arc(fx + L.x * k, fy + L.y * k, L.r * k, 0, 7);
    }
    o.fill();
  };

  const FORMS = [
    {
      line: "Let's do something memorable.",
      build: painting({
        art: "monalisa",
        word: "monalisa",
        eyes: [
          [0.44, 0.232],
          [0.553, 0.232],
        ],
        lift: (u, v) => {
          const head = 1 - sstep(0.8, 1.15, Math.hypot((u - 0.49) / 0.17, (v - 0.23) / 0.16));
          const body =
            v < 0.3
              ? 0
              : 1 - sstep(-0.04, 0.04, Math.abs(u - 0.5) - lerp(0.12, 0.5, (v - 0.3) / 0.7));
          return 0.3 + 0.8 * Math.max(head, body);
        },
      }),
    },
    {
      line: "All the colours were in your idea.",
      build: (() => {
        const tri = (w, h) => {
          const side = Math.min(w * 0.4, h * 0.62),
            hg = side * 0.87,
            c = w * 0.46,
            cy = h * 0.5;
          return {
            a: [c, cy - hg * 0.55],
            b: [c - side / 2, cy + hg * 0.45],
            c: [c + side / 2, cy + hg * 0.45],
            side,
            hg,
            cx: c,
            cy,
          };
        };
        const beams = ["red", "orange", "yellow", "green", "blue", "violet"];
        return drawn(
          [
            {
              word: "idea",
              dens: 0.9,
              draw: (o, w, h) => {
                const t = tri(w, h);
                o.lineWidth = lh * 1.2;
                o.beginPath();
                o.moveTo(0, t.cy + t.hg * 0.25);
                o.lineTo((t.a[0] + t.b[0]) / 2, (t.a[1] + t.b[1]) / 2 + t.hg * 0.02);
                o.stroke();
              },
            },
            ...beams.map((b, n) => ({
              word: "cells",
              ink: C[b],
              dens: 0.85,
              draw: (o, w, h) => {
                const t = tri(w, h);
                o.lineWidth = lh * 1.05;
                const sx = (t.a[0] + t.c[0]) / 2,
                  sy = (t.a[1] + t.c[1]) / 2 + t.hg * 0.08;
                o.beginPath();
                o.moveTo(sx, sy);
                o.lineTo(w, sy - h * 0.1 + n * h * 0.085);
                o.stroke();
              },
            })),
            {
              word: "prism",
              dens: 0.32,
              draw: (o, w, h) => {
                const t = tri(w, h);
                o.beginPath();
                o.moveTo(...t.a);
                o.lineTo(...t.b);
                o.lineTo(...t.c);
                o.closePath();
                o.fill();
              },
            },
            {
              word: "prism",
              dens: 1,
              draw: (o, w, h) => {
                const t = tri(w, h);
                o.lineWidth = lh * 1.4;
                o.beginPath();
                o.moveTo(...t.a);
                o.lineTo(...t.b);
                o.lineTo(...t.c);
                o.closePath();
                o.stroke();
              },
            },
          ],
          (w, h) => {
            const t = tri(w, h),
              e = lh * 2.6;
            return [
              [t.cx - e * 0.55, t.cy + t.hg * 0.05, e],
              [t.cx + e * 0.55, t.cy + t.hg * 0.03, e],
            ];
          },
        );
      })(),
    },
    {
      line: () =>
        ++wrangled % 2
          ? "Hire me to wrangle your digital dudes."
          : "Hire me to wrangle your digital dudettes.",
      build: (() => {
        const feet = (w, h) => ({ fx: w * 0.36, fy: h * 0.96, k: (h * 0.58) / 290 });
        return drawn(
          [
            {
              word: "aski",
              dens: 0.95,
              draw: (o, w, h) => {
                const { fx, fy, k } = feet(w, h);
                lobes(o, fx, fy, k);
              },
            },
            {
              word: "yeehaw",
              ink: C.rope,
              dens: 0.95,
              draw: (o, w, h) => {
                const { fx, fy, k } = feet(w, h);
                o.lineWidth = lh * 0.9;
                o.beginPath();
                o.moveTo(fx + 110 * k, fy - 120 * k);
                o.quadraticCurveTo(w * 0.78, h * 0.62, w * 0.76, h * 0.34);
                o.stroke();
                o.beginPath();
                o.ellipse(w * 0.76, h * 0.22, w * 0.17, h * 0.1, -0.12, 0, 7);
                o.stroke();
              },
            },
            {
              word: "yeehaw",
              ink: C.leather,
              dens: 1,
              draw: (o, w, h) => {
                const { fx, fy, k } = feet(w, h),
                  X = (x) => fx + x * k,
                  Y = (y) => fy + y * k;
                o.beginPath();
                o.ellipse(X(8), Y(-214), 128 * k, 17 * k, -0.06, 0, 7);
                o.fill();
                o.beginPath();
                o.moveTo(X(-58), Y(-214));
                o.bezierCurveTo(X(-62), Y(-300), X(-20), Y(-292), X(8), Y(-276));
                o.bezierCurveTo(X(36), Y(-292), X(78), Y(-300), X(72), Y(-214));
                o.closePath();
                o.fill();
              },
            },
          ],
          (w, h) => {
            const { fx, fy, k } = feet(w, h);
            return CLOUD_EYES.map(([x, y, e]) => [fx + x * k, fy + (y + 12) * k, e * k]);
          },
        );
      })(),
    },
    {
      line: "Dream in words. Wake up to things.",
      build: painting({
        art: "starry",
        word: "stars",
        eyes: [
          [0.655, 0.215],
          [0.885, 0.17],
        ],
      }),
    },
    {
      line: "Let me be the bridge.",
      build: drawn(
        [
          {
            word: "water",
            dens: 0.5,
            ch: (pc, pr) => (hash(9, pc, pr) < 0.5 ? "~" : "pond"[(pc + pr) % 4]),
            draw: (o, w, h) => {
              o.lineWidth = lh * 0.5;
              for (let y = h * 0.7; y < h; y += lh * 2) {
                o.globalAlpha = 0.55 + 0.45 * Math.random();
                o.beginPath();
                o.moveTo(w * 0.02 + (y % 37), y);
                o.lineTo(w * 0.98 - (y % 53), y);
                o.stroke();
              }
              o.globalAlpha = 1;
            },
          },
          {
            word: "bridge",
            dens: 0.35,
            draw: (o, w, h) => {
              o.lineWidth = lh * 0.9;
              o.beginPath();
              o.ellipse(w / 2, h * 0.74, w * 0.4, h * 0.3, 0, 0, Math.PI);
              o.stroke();
            },
          },
          {
            word: "bridge",
            dens: 0.65,
            ch: () => "|",
            draw: (o, w, h) => {
              o.lineWidth = cw * 0.9;
              for (let n = 1; n < 12; n++) {
                const a = Math.PI * (1 - n / 12),
                  x = w / 2 + Math.cos(a) * w * 0.42,
                  y = h * 0.7 - Math.sin(a) * h * 0.4;
                o.beginPath();
                o.moveTo(x, y);
                o.lineTo(x, y - h * 0.1);
                o.stroke();
              }
            },
          },
          {
            word: "bridge",
            dens: 0.8,
            draw: (o, w, h) => {
              o.lineWidth = lh * 0.8;
              o.beginPath();
              o.ellipse(w / 2, h * 0.6, w * 0.43, h * 0.4, 0, Math.PI * 1.04, Math.PI * 1.96);
              o.stroke();
            },
          },
          {
            word: "bridge",
            dens: 1,
            draw: (o, w, h) => {
              o.lineWidth = lh * 2.4;
              o.beginPath();
              o.ellipse(w / 2, h * 0.74, w * 0.42, h * 0.4, 0, Math.PI, Math.PI * 2);
              o.stroke();
            },
          },
        ],
        (w, h) => [
          [w / 2 - lh * 1.1, h * 0.34, lh * 2.2],
          [w / 2 + lh * 1.1, h * 0.34, lh * 2.2],
        ],
      ),
    },
    {
      line: "Time for wonder.",
      build: painting({
        art: "thinker",
        word: "thinker",
        dark: true,
        eyes: [
          [0.3, 0.262],
          [0.375, 0.252],
        ],
      }),
    },
    {
      line: "Need a light?",
      build: (() => {
        const geo = (w, h) => {
          const bw = Math.min(w * 0.34, h * 0.3),
            x = w * 0.5 - bw / 2;
          return { bw, x, top: h * 0.6, lid: h * 0.47 };
        };
        return drawn(
          [
            {
              word: "lighter",
              dens: 0.55,
              ch: (pc) => (pc % 2 ? ":" : "o"),
              draw: (o, w, h) => {
                const g = geo(w, h);
                o.fillRect(g.x + g.bw * 0.1, g.lid - h * 0.09, g.bw * 0.8, h * 0.09);
              },
            },
            {
              word: "lighter",
              dens: 0.8,
              draw: (o, w, h) => {
                const g = geo(w, h);
                o.fillRect(g.x, g.lid, g.bw, g.top - g.lid - lh * 0.5);
              },
            },
            {
              word: "lighter",
              dens: 1,
              draw: (o, w, h) => {
                const g = geo(w, h);
                o.beginPath();
                o.roundRect(g.x, g.top, g.bw, h * 0.36, lh * 0.8);
                o.fill();
              },
            },
            {
              word: "fire",
              ink: C.orange,
              dens: 1,
              draw: (o, w, h) => {
                const g = geo(w, h),
                  c = w * 0.5,
                  b = g.lid - h * 0.09;
                o.beginPath();
                o.moveTo(c, b);
                o.bezierCurveTo(
                  c - g.bw * 0.42,
                  b - h * 0.05,
                  c - g.bw * 0.2,
                  b - h * 0.22,
                  c + g.bw * 0.02,
                  b - h * 0.34,
                );
                o.bezierCurveTo(c + g.bw * 0.1, b - h * 0.2, c + g.bw * 0.42, b - h * 0.1, c, b);
                o.fill();
              },
            },
            {
              word: "fire",
              ink: C.yellow,
              dens: 1,
              draw: (o, w, h) => {
                const g = geo(w, h),
                  c = w * 0.5,
                  b = g.lid - h * 0.095;
                o.beginPath();
                o.moveTo(c, b);
                o.bezierCurveTo(
                  c - g.bw * 0.18,
                  b - h * 0.03,
                  c - g.bw * 0.08,
                  b - h * 0.12,
                  c + g.bw * 0.01,
                  b - h * 0.18,
                );
                o.bezierCurveTo(c + g.bw * 0.06, b - h * 0.1, c + g.bw * 0.18, b - h * 0.05, c, b);
                o.fill();
              },
            },
          ],
          (w, h) => {
            const g = geo(w, h),
              e = lh * 2.6;
            return [
              [w * 0.5 - g.bw * 0.17, g.top + h * 0.13, e],
              [w * 0.5 + g.bw * 0.17, g.top + h * 0.13, e],
            ];
          },
        );
      })(),
    },
    {
      line: "I'm all ears.",
      build: painting({
        art: "pearl",
        word: "pearl",
        eyes: [
          [0.355, 0.425],
          [0.505, 0.41],
        ],
      }),
    },
  ];
  let wrangled = 0;
  function formAt(n) {
    const f = FORMS[n];
    if (!f.cells) {
      const r = f.build();
      if (!r) return null;
      Object.assign(f, r);
    }
    return f;
  }

  // ── Morphing: every letter travels from one form to the next ─────────────
  function order(P) {
    let mx = 0,
      my = 0;
    for (const p of P) {
      mx += p.x;
      my += p.y;
    }
    mx /= P.length || 1;
    my /= P.length || 1;
    let rm = 1;
    for (const p of P) rm = Math.max(rm, Math.hypot(p.x - mx, p.y - my));
    return P.map((p) => ({
      p,
      k:
        Math.floor(((Math.atan2(p.y - my, p.x - mx) + Math.PI) / (2 * Math.PI)) * 40) +
        (Math.hypot(p.x - mx, p.y - my) / rm) * 0.999,
    }))
      .sort((a, b) => a.k - b.k)
      .map((o) => o.p);
  }
  function morph(A, B, delay = () => 0) {
    A = order(A);
    B = order(B);
    const N = Math.min(Math.max(A.length, B.length), 9000),
      parts = [];
    for (let n = 0; n < N; n++) {
      const a = A[Math.floor((n * A.length) / N)],
        b = B[Math.floor((n * B.length) / N)],
        h = hash(11, n);
      const dx = b.x - a.x,
        dy = b.y - a.y,
        bend = (h - 0.5) * 0.5;
      parts.push({
        a,
        b,
        mx: (a.x + b.x) / 2 - dy * bend,
        my: (a.y + b.y) / 2 + dx * bend,
        d: delay(a, b, n),
        T: 1.05 + hash(12, n) * 0.45,
      });
    }
    return parts;
  }
  function drawParts(parts, t, eyes) {
    for (const p of parts) {
      const u = clamp((t - p.d) / p.T, 0, 1),
        e = ease(u),
        v = 1 - e;
      const x = v * v * p.a.x + 2 * v * e * p.mx + e * e * p.b.x,
        y = v * v * p.a.y + 2 * v * e * p.my + e * e * p.b.y;
      if (nearEye(eyes, x, y) || inHole(x, y)) continue;
      const late = e > 0.5;
      G.glyph(
        late ? p.b.ch : p.a.ch,
        lerp(p.a.al, p.b.al, e),
        G.i(x),
        G.j(y),
        late ? p.b.ink : p.a.ink,
      );
    }
  }

  const nearEye = (E, x, y) =>
    E.some((e) => e.al > 0.3 && Math.abs(x - e.x) < e.h * 0.42 && Math.abs(y - e.y) < e.h * 0.62);
  const mixEyes = (A, B, u) =>
    A.map((a, k) => ({
      x: lerp(a.x, B[k].x, u),
      y: lerp(a.y, B[k].y, u),
      h: lerp(a.h, B[k].h, u),
    }));
  let blinkAt = 3;
  function openness(t) {
    const u = (t - blinkAt) / 0.2;
    if (u > 1) {
      blinkAt = t + 3 + hash(13, Math.floor(t)) * 4;
      return 1;
    }
    return u > 0 ? 1 - 0.92 * Math.sin(u * Math.PI) : 1;
  }
  function drawEyes(E, open) {
    const c = G.ctx;
    c.fillStyle = INK;
    for (const e of E) {
      if ((e.al ?? 1) < 0.01) continue;
      c.globalAlpha = e.al ?? 1;
      c.beginPath();
      eyePath(c, e.x, e.y, e.h, open);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  // ── The field your pointer stirs ───────────────────────────────────────────
  let pointer = null,
    occ = new Uint8Array(0);
  const mark = (cells) => {
    occ.fill(0);
    for (const c of cells) {
      const i = G.i(c.x),
        j = G.j(c.y);
      if (i >= 0 && j >= 0 && i < cols && j < rows) occ[j * cols + i] = 1;
    }
  };
  function field(stir = true) {
    const R = 110;
    for (let j = 0; j < rows; j++)
      for (let i = j % 2; i < cols; i += 3) {
        const x = G.x(i),
          y = G.y(j);
        if (inHole(x, y)) continue;
        let ch = ".",
          al = 0.1;
        if (occ[j * cols + i]) continue;
        if (pointer && stir) {
          const d = Math.hypot(x - pointer.x, (y - pointer.y) * 1.2);
          if (d < R) {
            const k = 1 - d / R;
            ch = "stemcells"[(i + j) % 9];
            al = 0.1 + 0.45 * k * k;
          }
        }
        G.glyph(ch, al, i, j, 0);
      }
  }

  // ── The show ───────────────────────────────────────────────────────────────
  // state: pond → gather → home ⇄ (morph → form)
  let state = reduce ? "home" : "pond",
    t0 = performance.now() / 1000,
    anim = null,
    here = -1,
    next = 0,
    holdTimer = 0,
    swapped = false;
  const HOLD = 6.5;
  function placeSay(form) {
    const x = form ? box.x : cx,
      y = form ? Math.min(form.bottom + 14, H - 64) : gy + 16;
    sayEl.style.left = x + "px";
    sayEl.style.top = y + "px";
  }
  function swapHeadline() {
    if (swapped) return;
    swapped = true;
    const sw = $(".swap"),
      a = sw.querySelector('[data-w="a"]'),
      b = sw.querySelector('[data-w="b"]');
    if (reduce) {
      a.textContent = "words";
      b.textContent = "things";
      return;
    }
    const ra = a.getBoundingClientRect(),
      rb = b.getBoundingClientRect(),
      dx = rb.left - ra.left;
    a.style.transition = b.style.transition = "transform 1.1s cubic-bezier(.65,0,.35,1)";
    a.style.transform = `translate(${dx + (rb.width - ra.width)}px, -0.12em)`;
    b.style.transform = `translate(${-dx}px, 0.12em)`;
    setTimeout(() => {
      a.style.transition = b.style.transition = "none";
      a.style.transform = b.style.transform = "";
      a.textContent = "words";
      b.textContent = "things";
    }, 1150);
  }
  function startGather(now) {
    const t = now - t0;
    const K = koiEyes(t),
      src = drawPond(t, K, true);
    const E = cloudEyes();
    const far = Math.hypot(W, H);
    anim = {
      kind: "gather",
      t0: now,
      parts: morph(src, HOME, (a) =>
        a.koi
          ? hash(14, a.x, a.y) * 0.15
          : 0.15 + (0.7 * Math.hypot(a.x - cx, a.y - gy)) / far + hash(15, a.x, a.y) * 0.25,
      ),
      E0: K,
      E1: E,
      dur: 2.5,
    };
    state = "gather";
    setTimeout(swapHeadline, 300);
  }
  function go(n, now) {
    clearTimeout(holdTimer);
    say.hide();
    const target = n < 0 ? { cells: HOME, eyes: cloudEyes() } : formAt(n);
    if (!target) return;
    const from = here < 0 ? { cells: HOME, eyes: cloudEyes() } : FORMS[here];
    if (reduce) {
      arrive(n, target);
      return;
    }
    anim = {
      kind: "morph",
      t0: now,
      parts: morph(from.cells, target.cells, (a, b) => hash(16, b.x, b.y) * 0.45),
      E0: from.eyes,
      E1: target.eyes,
      dur: 2.05,
      to: n,
      target,
      fromHome: here < 0,
    };
    state = "morph";
    here = n;
    hintEl.classList.remove("on");
  }
  function arrive(n, target) {
    here = n;
    anim = null;
    state = n < 0 ? "home" : "form";
    mark(n < 0 ? HOME : target.cells);
    placeSay(n < 0 ? null : target);
    if (n >= 0) {
      const f = FORMS[n];
      say.type(typeof f.line === "function" ? f.line() : f.line);
      holdTimer = setTimeout(() => {
        go(-1, performance.now() / 1000);
        show.kick();
      }, HOLD * 1000);
    }
    show.kick();
  }

  function draw(now) {
    const ctx = G.ctx;
    ctx.clearRect(0, 0, W, H);
    const t = now - t0;
    let more = false;
    if (state === "pond") {
      if (t >= T.gather) startGather(now);
      else {
        const K = koiEyes(t),
          al = sstep(1.4, 2.2, t);
        K.forEach((e) => {
          e.al = al;
        });
        field(false);
        drawPond(t, K);
        drawEyes(K, openness(t));
        return true;
      }
    }
    if (anim) {
      const u = now - anim.t0,
        done = u >= anim.dur + 0.35;
      const E = mixEyes(anim.E0, anim.E1, ease(sstep(0, anim.dur * 0.62, u)));
      occ.fill(0);
      field(false);
      if (anim.kind === "gather" || anim.to < 0) {
        // Letters land, then close into the cloud.
        const solid = sstep(anim.dur - 0.1, anim.dur + 0.3, u);
        if (solid < 1) {
          drawParts(anim.parts, u, E);
        }
        drawCloud(solid, 1);
        drawEyes(
          E.map((e) => ({ ...e, al: 1 - solid })),
          1,
        );
        if (anim.kind === "gather") {
          ctx.globalAlpha = 0.3 * sstep(anim.dur - 0.2, anim.dur + 0.3, u);
          ctx.fillStyle = INK;
          ctx.fillRect(cx - s * 170, gy, s * 340, 1);
          ctx.globalAlpha = 1;
        }
      } else {
        drawParts(anim.parts, u, E);
        drawEyes(E, 1);
        // Leaving home, the cloud comes apart into its letters as they go.
        if (anim.fromHome && u < 0.3) drawCloud(1 - sstep(0, 0.3, u), 1);
      }
      if (done) {
        if (anim.kind === "gather") {
          anim = null;
          state = "home";
          here = -1;
          placeSay(null);
          mark(HOME);
          setTimeout(() => say.type("I can be whatever you want."), 250);
          setTimeout(() => {
            if (state === "home") hintEl.classList.add("on");
          }, 2600);
        } else arrive(anim.to, anim.target);
      }
      more = true;
    } else {
      field();
      const open = openness(t);
      if (state === "home") {
        drawCloud(1, open);
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = INK;
        ctx.fillRect(cx - s * 170, gy, s * 340, 1);
        ctx.globalAlpha = 1;
      } else {
        const f = FORMS[here];
        for (const c of f.cells)
          if (
            !nearEye(
              f.eyes.map((e) => ({ ...e, al: 1 })),
              c.x,
              c.y,
            )
          )
            G.glyph(c.ch, c.al, G.i(c.x), G.j(c.y), c.ink);
        drawEyes(f.eyes, open);
      }
      more = open < 1;
    }
    return more;
  }

  const show = kit.loop(stage, (now) => draw(now));
  function tap(e) {
    if (e.target.closest("a, button, input")) return;
    const now = performance.now() / 1000;
    if (state === "pond") {
      startGather(now);
      show.kick();
      return;
    }
    if (state === "gather" || state === "morph") return;
    const n = next;
    next = (next + 1) % FORMS.length;
    go(n, now);
    show.kick();
  }
  stage.addEventListener("click", tap);
  stage.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const b = cv.getBoundingClientRect();
    pointer = { x: e.clientX - b.left, y: e.clientY - b.top };
    show.kick();
  });
  stage.addEventListener("pointerleave", () => {
    pointer = null;
    show.kick();
  });
  // Blinks come on their own while nothing else moves.
  setInterval(() => {
    if (state === "home" || state === "form") show.kick();
  }, 1000);
  let rt = 0;
  addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      setup();
      pondLayout();
      show.kick();
    }, 120);
  });

  // Images first, so the first form is ready on the first click.
  ["monalisa", "starry", "thinker", "pearl"].forEach(image);
  setup();
  pondLayout();
  pads = [
    [0.12, 0.2, 30, 1.1],
    [0.9, 0.26, 38, 3.9],
    [0.08, 0.86, 42, 5.2],
    [0.94, 0.84, 28, 2.4],
    [0.55, 0.08, 22, 0.3],
  ].map(([u, v, r, n]) => ({ x: u * W, y: v * H, r, n }));
  if (reduce) {
    swapHeadline();
    placeSay(null);
    say.type("I can be whatever you want.");
    hintEl.classList.add("on");
  }
  t0 = performance.now() / 1000;
  show.kick();
})();
