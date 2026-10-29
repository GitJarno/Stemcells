// The four acts below the hero: a birth, growth, an ask, and the way home.
(() => {
  "use strict";
  const { clamp, lerp, sstep, ease, hash, cloudLayer, reduce } = kit;
  const INK = "#EDE9E0";
  // Cells wear their provider's colour; amber means one thing only: it needs you.
  const COLORS = [INK, "#D97757", "#5FB98E", "#7A9CF0", "#C9C2B4", "#ECA840"];
  const AMBER = 5,
    BODY = [1, 2, 1, 3, 2, 4];

  // ── A stage: a canvas, a grid, and a clock that runs while it's on screen ──
  function act(id, { draw, setup = () => {} }) {
    const el = document.getElementById(id),
      cv = el.querySelector("canvas");
    const st = { el, G: null, t0: null, cache: {} };
    st.layout = () => {
      const font = el.clientWidth < 520 ? 9 : 10;
      st.G = kit.grid(cv, { font, lh: Math.round(font * 1.25), inks: COLORS });
      setup(st);
    };
    st.layout();
    const run = kit.loop(el, (now) => {
      if (st.t0 === null) st.t0 = now;
      st.G.ctx.clearRect(0, 0, st.G.W, st.G.H);
      return draw(st, reduce ? 99 : now - st.t0, now) !== false;
    });
    st.kick = run.kick;
    let rt = 0;
    addEventListener("resize", () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        st.layout();
        run.kick();
      }, 140);
    });
    return st;
  }
  const text = (G, str, i, j, al = 1, ink = 0) => {
    for (let k = 0; k < str.length; k++) G.glyph(str[k], al, i + k, j, ink);
  };
  const textC = (G, str, x, j, al, ink) =>
    text(G, str, Math.round(G.i(x) - str.length / 2 + 0.5), j, al, ink);
  const typed = (str, t, at, cps = 26) =>
    str.slice(0, clamp(Math.floor((t - at) * cps), 0, str.length));
  const off = document.createElement("canvas");
  function cloud(G, x, y, s, al = 1, open = 1, sx = 1, sy = 1) {
    if (al < 0.01) return;
    const b = cloudLayer(off, s, INK, open, sx, sy);
    G.ctx.globalAlpha = al;
    G.ctx.drawImage(off, x + b.x, y + b.y, b.w, b.h);
    G.ctx.globalAlpha = 1;
  }
  const blinkAt = (t, seed) => {
    const p = 3.2 + hash(seed, 1) * 2,
      u = ((t + hash(seed, 2) * p) % p) / 0.18;
    return u < 1 ? 1 - Math.sin(u * Math.PI) : 1;
  };

  // ── A Cell, set in blocks on the grid ─────────────────────────────────────
  // A low soft dome, no outline, two black eyes; density is life.
  // Each row is two half-rows tall, so the dome's edge steps half as coarsely.
  function shape(BW, BH) {
    const out = [],
      mid = (BW - 1) / 2,
      inside = (c, h) => {
        const v = (h + 0.9) / (BH * 2);
        return Math.abs(c - mid) < (BW / 2) * Math.sqrt(1 - (1 - v) ** 2);
      };
    for (let r = 0; r < BH; r++)
      for (let c = 0; c < BW; c++) {
        const top = inside(c, 2 * r),
          bot = inside(c, 2 * r + 1);
        if (top || bot) out.push({ c, r, half: top && bot ? "" : bot ? "▄" : "▀" });
      }
    const right = new Map();
    for (const p of out) if (!p.half) right.set(p.r, Math.max(right.get(p.r) ?? -1, p.c));
    return out.map((p) => ({ ...p, shade: !p.half && (p.r === BH - 1 || right.get(p.r) === p.c) }));
  }
  const SHAPES = {};
  /** feet: centre of the bottom row. o: { ink, life 0 letters … 4 solid, eyes 'open'|'shut'|'!'|'^', arms 0–3, flex 0–1, word, al } */
  function cell(G, x, feetY, o) {
    const BW = o.BW ?? 13,
      BH = o.BH ?? 6,
      key = BW + "x" + BH,
      S = SHAPES[key] ?? (SHAPES[key] = shape(BW, BH));
    const i0 = Math.round(G.i(x) - (BW - 1) / 2),
      j0 = G.j(feetY) - BH + 1,
      er = Math.floor(BH * 0.42),
      mid = (BW - 1) / 2;
    const eyesAt = [Math.round(mid - BW * 0.18), Math.round(mid + BW * 0.18)];
    const life = o.life ?? 4,
      al = o.al ?? 1,
      word = o.word ?? "cell";
    for (const { c, r, shade, half } of S) {
      const eye = r === er && eyesAt.includes(c);
      if (eye && life >= 3.5 && o.eyes !== "shut") {
        if (o.eyes === "!")
          G.glyph("!", al * (Math.floor(o.t / 0.53) % 2 ? 0.35 : 1), i0 + c, j0 + r, AMBER);
        else if (o.eyes === "^") G.glyph("^", al, i0 + c, j0 + r, 0);
        continue;
      }
      let ch;
      if (life < 1) {
        if (hash(21, c, r) > 0.25 + life * 0.75) continue;
        ch = word[(c + r * 2) % word.length];
      } else
        ch =
          half && life >= 3
            ? half
            : life < 2
              ? "░"
              : life < 3
                ? "▒"
                : life < 4 || shade
                  ? "▓"
                  : "█";
      G.glyph(ch, al, i0 + c, j0 + r, o.ink);
    }
    // Arms grow with time alone. Raised in a flex, hanging otherwise.
    const L = o.arms ?? 0;
    if (L && life >= 4) {
      const ar = BH - 2,
        row = S.filter((p) => p.r === ar),
        left = Math.min(...row.map((p) => p.c)),
        right = Math.max(...row.map((p) => p.c));
      for (const side of [-1, 1]) {
        const base = side < 0 ? left - 1 : right + 1,
          reach = L === 1 ? 1 : L;
        for (let k = 0; k < reach; k++)
          G.glyph(L === 1 ? "▄" : "█", al, i0 + base + side * k, j0 + ar, o.ink);
        if (L >= 2) {
          const end = i0 + base + side * (reach - 1),
            up = L - 1 + ((o.flex ?? 0) > 0.5 ? 1 : 0);
          for (let k = 1; k <= up; k++) G.glyph("█", al, end, j0 + ar - k, o.ink);
          if (L >= 3) G.glyph("▄", al, i0 + base + side * (reach - 2), j0 + ar - 1, o.ink);
        }
      }
    }
    return { top: G.y(j0), i0, j0 };
  }
  // A bud: a small round cloud of letters, spelled in its word.
  function bud(G, x, y, word, al, r = 2.6, ink = 0) {
    const ci = G.i(x),
      cj = G.j(y),
      R = Math.ceil(r * 2);
    for (let dj = -Math.ceil(r); dj <= Math.ceil(r); dj++)
      for (let di = -R; di <= R; di++) {
        if ((di / 2) ** 2 + dj * dj > r * r) continue;
        G.glyph(word[(di + R + (dj + 9) * 3) % word.length], al, ci + di, cj + dj, ink);
      }
  }

  // ── 01 · The birth ─────────────────────────────────────────────────────────
  const STOP = new Set(
    "the and for with that this from into your my our a an to of in on at by it is be me make build".split(
      " ",
    ),
  );
  const FIRST = ["Hello, world.", "New Cell. Who dis?", "Born ready.", "Three seconds old."];
  const tell = document.getElementById("tell"),
    form = document.querySelector(".tell");
  let job = null,
    demoed = false;
  function words(idea, max) {
    const ws = [...new Set(idea.toLowerCase().match(/[a-z]+/g) ?? [])]
      .filter((w) => w.length > 2 && !STOP.has(w))
      .slice(0, max);
    for (const d of ["build", "test", "ship"]) if (ws.length < 2 && !ws.includes(d)) ws.push(d);
    return ws;
  }
  const birth = act("birth", {
    setup(st) {
      const { G } = st,
        narrow = G.W < 520;
      st.s = (G.H * (narrow ? 0.3 : 0.36)) / 224;
      st.cx = G.W * (narrow ? 0.19 : 0.2);
      st.gy = G.H * 0.9;
      st.max = narrow ? 3 : 4;
      st.BW = narrow ? 11 : 13;
    },
    draw(st, t, now) {
      const { G, s, cx, gy } = st;
      G.ctx.globalAlpha = 0.3;
      G.ctx.fillStyle = INK;
      G.ctx.fillRect(cx - s * 160, gy, s * 320, 1);
      G.ctx.globalAlpha = 1;
      if (!job) {
        cloud(G, cx, gy, s, 1, blinkAt(t, 3));
        if (!demoed && t > 0.6) {
          demoed = true;
          demo();
        }
        return true;
      }
      const u = now - job.t0,
        n = job.words.length,
        mouth = [cx + 10 * s, gy - 140 * s];
      // Your words leave the field and go into Aski.
      job.chars.forEach((c, k) => {
        const p = clamp((u - k * 0.018) / 0.7, 0, 1);
        if (p <= 0 || p >= 1) {
          if (p <= 0) G.glyph(c.ch, 1, G.i(c.x), G.j(c.y));
          return;
        }
        const e = ease(p),
          mx = (c.x + mouth[0]) / 2,
          my = Math.min(c.y, mouth[1]) - 40;
        const x = (1 - e) ** 2 * c.x + 2 * (1 - e) * e * mx + e * e * mouth[0],
          y = (1 - e) ** 2 * c.y + 2 * (1 - e) * e * my + e * e * mouth[1];
        G.glyph(c.ch, 1 - sstep(0.75, 1, p), G.i(x), G.j(y));
      });
      const churn = sstep(1.3, 1.5, u) * (1 - sstep(2, 2.3, u));
      const pinch = job.words.reduce(
        (m, _, k) =>
          Math.max(m, Math.max(0, Math.sin(clamp((u - 2.1 - k * 0.24) / 0.3, 0, 1) * Math.PI))),
        0,
      );
      cloud(
        G,
        cx,
        gy,
        s,
        1,
        blinkAt(t, 3),
        1 + churn * 0.05 * Math.sin(u * 22) + pinch * 0.05,
        1 - churn * 0.04 * Math.sin(u * 22) - pinch * 0.04,
      );
      // Each Cell buds off, spelled in its word, flies to its place and develops.
      const span = G.W - (cx + 140 * s) - 30,
        x0 = cx + 140 * s + span / (2 * n),
        feet = G.H * 0.62;
      job.words.forEach((w, k) => {
        const tb = 2.1 + k * 0.24,
          ta = tb + 0.85,
          sx = x0 + (k * span) / n;
        if (u < tb) return;
        if (u < ta) {
          const e = ease((u - tb) / 0.85),
            ax = cx + 120 * s,
            ay = gy - 120 * s,
            by = feet - 3 * G.lh;
          const x = lerp(ax, sx, e),
            y = lerp(ay, by, e) - Math.sin(e * Math.PI) * G.H * 0.18;
          bud(G, x, y, w, 1, lerp(1.6, 2.6, e));
          return;
        }
        const life = clamp(((u - ta) / 0.9) * 4, 0, 4);
        const open = u > ta + 1 ? blinkAt(u, 30 + k) : 0;
        cell(G, sx, feet, {
          ink: BODY[k % BODY.length],
          life: life < 4 ? life : 4,
          eyes: life < 4 || open < 0.5 ? "shut" : "open",
          word: w,
          BW: st.BW,
          t: u,
        });
        textC(G, w.toUpperCase(), sx, G.j(feet) + 2, 0.55 * sstep(ta, ta + 0.6, u), 0);
        if (k === 0) textC(G, typed(job.first, u, ta + 1.3), sx, G.j(feet) - 8, 0.9, 0);
      });
    },
  });
  function send(idea) {
    idea = idea.trim();
    if (!idea) return;
    const r = tell.getBoundingClientRect(),
      b = birth.el.getBoundingClientRect(),
      G = birth.G;
    const m = G.ctx;
    m.save();
    m.font = getComputedStyle(tell).font;
    const cw = m.measureText("M").width;
    m.restore();
    const chars = [...idea]
      .map((ch, k) => ({
        ch,
        x: r.left - b.left + cw * (k + 0.5),
        y: r.top - b.top + r.height / 2,
      }))
      .filter((c) => c.ch !== " ");
    job = {
      t0: performance.now() / 1000,
      chars,
      words: words(idea, birth.max),
      first: FIRST[(hash(41, idea.length) * FIRST.length) | 0],
    };
    tell.value = "";
    birth.kick();
  }
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearTimeout(demoTimer);
    send(tell.value);
  });
  tell.addEventListener("focus", () => clearTimeout(demoTimer));
  let demoTimer = 0;
  function demo() {
    const idea = "a recipe app with a shopping list";
    if (reduce) {
      send(idea);
      return;
    }
    let n = 0;
    const tick = () => {
      tell.value = idea.slice(0, ++n);
      demoTimer = n < idea.length ? setTimeout(tick, 55) : setTimeout(() => send(idea), 500);
    };
    demoTimer = setTimeout(tick, 400);
  }

  // ── 02 · Growth ────────────────────────────────────────────────────────────
  const CREW = [
    { arms: 0, alone: "4 min alone" },
    { arms: 2, alone: "40 min alone" },
    { arms: 3, alone: "3 h alone" },
  ];
  act("grow", {
    draw(st, t) {
      const { G } = st,
        feet = G.H * 0.62;
      CREW.forEach((c, k) => {
        const x = G.W * (0.2 + k * 0.3),
          flex = k === 2 ? (t % 3.4 > 1.4 && t % 3.4 < 2.6 ? 1 : 0) : 0;
        cell(G, x, feet, {
          ink: BODY[k],
          arms: c.arms,
          flex,
          eyes: blinkAt(t, 50 + k) < 0.5 ? "shut" : "open",
          BW: G.W < 520 ? 9 : 13,
          BH: G.W < 520 ? 5 : 6,
          t,
        });
        textC(G, c.alone, x, G.j(feet) + 2, 0.55, 0);
      });
      textC(
        G,
        typed("Look at those arms.", t, 1.6),
        G.W * 0.8,
        G.j(feet) - (G.W < 520 ? 8 : 9),
        0.9,
        0,
      );
      textC(G, "strength = time without you", G.W / 2, G.rows - 3, 0.32, 0);
    },
  });

  // ── 03 · The ask ───────────────────────────────────────────────────────────
  const NAMES = ["Pip", "Moose", "Mango", "Birb", "Doot"];
  act("ask", {
    draw(st, t) {
      const { G } = st,
        n = G.W < 520 ? 4 : 5,
        feet = G.H * 0.5,
        cyc = t % 9,
        asking = cyc > 1.6 && cyc < 6.4,
        who = 2;
      for (let k = 0; k < n; k++) {
        const x = (G.W * (k + 0.5)) / n,
          me = asking && k === who;
        const bob = me ? 0 : Math.round(Math.sin(t * 1.4 + k) * 0.6);
        cell(G, x, feet + bob * G.lh, {
          ink: BODY[k],
          eyes: me ? "!" : blinkAt(t, 60 + k) < 0.5 ? "shut" : "open",
          BW: 9,
          BH: 4,
          t,
        });
        textC(G, NAMES[k], x, G.j(feet) - 5, 0.7, 0);
        textC(
          G,
          me ? "Needs you" : "Flying" + ".".repeat(Math.floor(t * 2 + k) % 4).padEnd(3),
          x,
          G.j(feet) + 2,
          me ? 1 : 0.45,
          me ? AMBER : 0,
        );
      }
      if (asking) {
        const q = typed("Mango: merge to main?", cyc, 2.2, 30),
          j = G.j(G.H * 0.78);
        textC(G, q, G.W / 2, j, 1, 0);
        if (cyc > 3.2)
          textC(G, "[ merge ]   [ not yet ]", G.W / 2, j + 2, cyc > 5.6 ? 0.3 : 0.85, 0);
      } else if (cyc > 6.4 && cyc < 8.6)
        textC(G, "Merged. Back to flying.", G.W / 2, G.j(G.H * 0.78), 0.55, 0);
    },
  });

  // ── 04 · Home ──────────────────────────────────────────────────────────────
  const LAST = [
    "Gone, but committed.",
    "Rest in prod.",
    "I knew you briefly. Good person.",
    "You were the best part of my context.",
    "Back to the alphabet I came from.",
  ];
  act("home", {
    setup(st) {
      const { G } = st;
      st.s = (G.H * 0.32) / 224;
      st.cx = G.W * 0.26;
      st.gy = G.H * 0.86;
      st.x = G.W * 0.7;
      st.feet = G.H * 0.62;
    },
    draw(st, t) {
      const { G, s, cx, gy, x, feet } = st,
        P = 10.5,
        round = Math.floor(t / P),
        u = t % P,
        last = LAST[round % LAST.length];
      const ink = BODY[round % BODY.length],
        next = BODY[(round + 1) % BODY.length],
        BW = G.W < 520 ? 11 : 13;
      G.ctx.globalAlpha = 0.3;
      G.ctx.fillStyle = INK;
      G.ctx.fillRect(cx - s * 160, gy, s * 320, 1);
      G.ctx.globalAlpha = 1;
      const fill = sstep(5.2, 5.6, u) * (1 - sstep(5.8, 6.4, u));
      cloud(G, cx, gy, s, 1, blinkAt(t, 70), 1 + fill * 0.05, 1 - fill * 0.03);
      // Last words, then the Cell steps down into letters, and they go home.
      const life = 4 - clamp(((u - 3.4) / 0.8) * 4, 0, 4);
      if (u < 4.25)
        cell(G, x, feet, {
          ink,
          life,
          eyes: u > 3.1 ? "shut" : blinkAt(t, 71) < 0.5 ? "shut" : "open",
          word: last.replace(/\W/g, "").toLowerCase(),
          BW,
          t: u,
        });
      const lw = u < 4.2 ? typed(last, u, 0.8, 22) : "";
      const wj = G.j(feet) - 8;
      if (lw) textC(G, lw, x, wj, 0.9, 0);
      if (u >= 4.2 && u < 6.2) {
        const target = [cx + 8 * s, gy - 120 * s],
          letters = (last.replace(/\s/g, "") + "cellcellcellcell").slice(0, 34);
        [...letters].forEach((ch, k) => {
          const sx = x + ((k % 13) - 6) * G.cw,
            sy = k < last.length ? G.y(wj) : feet - (k % 5) * G.lh;
          const p = clamp((u - 4.2 - k * 0.03) / 1, 0, 1),
            e = ease(p);
          const px = lerp(sx, target[0], e),
            py = lerp(sy, target[1], e) - Math.sin(e * Math.PI) * G.H * 0.16;
          G.glyph(ch, 1 - sstep(0.8, 1, p), G.i(px), G.j(py), p < 0.5 ? ink : 0);
        });
      }
      // Renewal: a new Cell, made from the same letters.
      if (u >= 6.6) {
        const tb = 6.6,
          ta = 7.45;
        if (u < ta) {
          const e = ease((u - tb) / 0.85);
          bud(
            G,
            lerp(cx + 110 * s, x, e),
            lerp(gy - 110 * s, feet - 3 * G.lh, e) - Math.sin(e * Math.PI) * G.H * 0.14,
            "aski",
            1,
            lerp(1.6, 2.6, e),
          );
        } else {
          const l = clamp(((u - ta) / 0.9) * 4, 0, 4);
          cell(G, x, feet, {
            ink: next,
            life: l,
            eyes: l < 4 || blinkAt(u, 72) < 0.5 ? "shut" : "open",
            word: "aski",
            BW,
            t: u,
          });
          if (u > ta + 1.3) textC(G, typed("Hello, world.", u, ta + 1.3), x, wj, 0.9, 0);
        }
      }
    },
  });
})();
