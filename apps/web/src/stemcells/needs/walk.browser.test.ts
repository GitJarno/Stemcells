import { describe, expect, it } from "vite-plus/test";

import { answering, enter, leave, reveal, step } from "./walk";

/** A frame with Aski's composer and cards: "r" recommends, "a" recommends an allow, "-" nothing, "x" is answered. */
function frame(
  cards: string,
): Disposable & { readonly composer: HTMLElement; card(n: number): HTMLElement } {
  const root = document.createElement("div");
  root.dataset.stemcellsNeedsFrame = "";
  root.innerHTML = `
    <div data-stemcells-needs-main=""><div contenteditable="true"></div></div>
    <div data-stemcells-needs-list="">${[...cards]
      .map(
        (kind, i) => `
      <section data-stemcells-need="" tabindex="-1" ${kind === "x" ? "" : "data-open"} data-n="${i + 1}" data-need-key="ask:${i + 1}">
        <button data-need-option="" data-allows ${kind === "a" ? "data-recommended" : ""}>Allow</button>
        <button data-need-option="" ${kind === "r" ? "data-recommended" : ""}>Take</button>
      </section>`,
      )
      .join("")}</div>`;
  document.body.append(root);
  return {
    composer: root.querySelector<HTMLElement>("[contenteditable]")!,
    card: (n) => root.querySelector<HTMLElement>(`[data-n="${n}"]`)!,
    [Symbol.dispose]: () => root.remove(),
  };
}

/** Where the focus is: "1 Take", "2", or "composer". */
function focus(): string {
  const at = document.activeElement as HTMLElement;
  if (at.isContentEditable) return "composer";
  const card = at.closest<HTMLElement>("[data-stemcells-need]")!;
  return at === card ? card.dataset.n! : `${card.dataset.n} ${at.textContent}`;
}

describe("the cards' walk", () => {
  it("lands on a card's recommendation, never on an allow, else on the card", () => {
    using page = frame("ra-");
    expect(enter(page.composer)).toBe(true);
    expect(focus()).toBe("1 Take");
    step(document.activeElement!, 1);
    expect(focus()).toBe("2");
    step(document.activeElement!, 1);
    expect(focus()).toBe("3");
    expect(step(document.activeElement!, 1)).toBe(false);
    step(document.activeElement!, -1);
    expect(focus()).toBe("2");
  });

  it("steps over answered cards, in the list's order", () => {
    using page = frame("rxr");
    page.card(1).querySelector<HTMLElement>("[data-recommended]")!.focus();
    step(document.activeElement!, 1);
    expect(focus()).toBe("3 Take");
  });

  it("an answer from the keyboard steps on, and after the last goes back to the composer", () => {
    using page = frame("rr");
    enter(page.composer);
    answering(page.card(1));
    expect(focus()).toBe("2 Take");
    answering(page.card(2));
    expect(focus()).toBe("composer");
    leave(page.card(1));
    expect(focus()).toBe("composer");
  });

  it("an answer by pointer leaves the focus where it is", () => {
    using page = frame("rr");
    page.composer.focus();
    answering(page.card(1));
    expect(focus()).toBe("composer");
  });

  it("reveals an ask the room shows where a step onto it lands, and says when it doesn't", () => {
    using page = frame("-r");
    expect(reveal("ask:2")).toBe(true);
    expect(focus()).toBe("2 Take");
    expect(reveal("ask:9")).toBe(false);
    expect(focus()).toBe("2 Take");
    page.composer.focus();
  });

  it("one ask at a time: an answer from the keyboard, or a reveal from the line, lands on the next ask once it walks in", () => {
    using page = frame("r");
    const one = document.createElement("div");
    one.dataset.needsOne = "";
    page.card(1).before(one);
    one.append(page.card(1));
    const seat = document.createElement("button");
    seat.dataset.needSeat = "ask:2";
    let picked = 0;
    seat.addEventListener("click", () => (picked += 1));
    one.append(seat);
    enter(page.composer);
    answering(page.card(1));
    expect(focus()).toBe("1 Take");
    expect(one.hasAttribute("data-land-next")).toBe(true);
    one.removeAttribute("data-land-next");
    expect(reveal("ask:2")).toBe(true);
    expect(picked).toBe(1);
    expect(one.hasAttribute("data-land-next")).toBe(true);
  });

  it("has nowhere to go with no card open", () => {
    using page = frame("x");
    expect(enter(page.composer)).toBe(false);
  });
});
