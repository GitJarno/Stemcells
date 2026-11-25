// Runs in the page: where each landmark of the picture sits, in CSS pixels, from the live DOM.
(() => {
  const seen = (el) => {
    const r = el.getBoundingClientRect();
    return (
      r.width > 1 &&
      r.height > 1 &&
      r.right > 0 &&
      r.x < innerWidth &&
      r.bottom > 0 &&
      r.y < innerHeight
    );
  };
  const box = (el) => {
    const r = el.getBoundingClientRect();
    const x = Math.max(0, r.x),
      y = Math.max(0, r.y);
    return {
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(Math.min(innerWidth, r.right) - x),
      h: Math.round(Math.min(innerHeight, r.bottom) - y),
    };
  };
  const union = (boxes) => {
    if (boxes.length === 0) return null;
    const x = Math.min(...boxes.map((b) => b.x)),
      y = Math.min(...boxes.map((b) => b.y));
    return {
      x,
      y,
      w: Math.max(...boxes.map((b) => b.x + b.w)) - x,
      h: Math.max(...boxes.map((b) => b.y + b.h)) - y,
    };
  };
  const all = (selector, root = document) => [...root.querySelectorAll(selector)].filter(seen);
  const out = {};
  const put = (name, el) => {
    if (el) out[name] = el instanceof Element ? box(el) : el;
  };

  const column = all("[data-stemcells-cells][data-stemcells-proxy]")[0];
  put("column", column);
  if (column) {
    const names = {
      needs: "input",
      working: "flying",
      landed: "landed",
      settled: "settled",
      pinned: "pinned",
    };
    const rows = [];
    for (const button of all("button[data-cells-stage]", column)) {
      const name = names[button.getAttribute("data-cells-stage")];
      if (!name) continue;
      out[`stage.${name}`] = box(button);
      rows.push(box(button));
    }
    put("stageList", union(rows));
    const asks = all("[data-stemcells-need]", column).sort(
      (a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height,
    );
    put("askCard", asks[0]);
  }
  put("tabs", all("[data-stemcells-tab-strip]")[0]);
  all("[data-stemcells-tab]").forEach((tab, index) => put(`tab[${index}]`, tab));
  // Other tabs' panes stay mounted beside the open one: only those inside the open page count.
  const slate = all("[data-stemcells-slate]")[0]?.getBoundingClientRect() ?? {
    x: 0,
    right: innerWidth,
  };
  const open = (pane) => {
    const r = pane.getBoundingClientRect();
    return r.x >= slate.x - 1 && r.right <= slate.right + 1;
  };
  const panes = all("[data-stemcells-pane]")
    .filter(open)
    .sort((a, b) => {
      const ra = a.getBoundingClientRect(),
        rb = b.getBoundingClientRect();
      return Math.abs(ra.y - rb.y) > 8 ? ra.y - rb.y : ra.x - rb.x;
    });
  panes.forEach((pane, index) => {
    put(`pane[${index}]`, pane);
    put(
      `composer[${index}]`,
      union(all("[data-stemcells-composer-line], [data-stemcells-composer-glass]", pane).map(box)),
    );
  });
  // The Cell's answer: the text block of its last message in the first pane (a chart, a diagram
  // or a closing card it wrote is part of it), as far as the window shows it.
  if (panes[0])
    put("reply", all('[data-message-role="assistant"] [data-thread-find-text]', panes[0]).at(-1));
  // A page the Cell drew in the first pane (`html_render`): the frame it is shown in.
  if (panes[0]) put("page", all(".html-preview-lane iframe", panes[0]).at(-1));
  put("closeOut", all("[data-stemcells-close-out]")[0]);
  put("aski", all("[data-stemcells-aski-perch]")[0]);
  const toggle = all("[data-pending-user-input-toggle]")[0];
  if (toggle) {
    let panel = toggle;
    while (panel.parentElement && panel.getBoundingClientRect().height < 120)
      panel = panel.parentElement;
    put("question", panel);
    all("button[aria-pressed]", panel).forEach((option, index) => put(`option[${index}]`, option));
    put("preview", all("[data-option-preview]", panel)[0]);
  }
  return out;
})();
