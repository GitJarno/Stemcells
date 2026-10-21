/**
 * A chat's one scroll indicator is T3's ask marks: hidden at rest, shown
 * while the reader scrolls, gone a glance after. A reply the list follows to
 * its end scrolls many times a second; were that the reader's, the marks
 * would flicker through every streamed reply.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { showMarksWhileScrolling } from "./scrollIndicator";

vi.mock("../tokens/motion", () => ({ timing: () => 1200 }));

const GLANCE = 600;
const SHOWN = "data-stemcells-shown";

type Listener = (event: object) => void;

/** Just enough of an element: a tree, attributes, selectors by name, and listeners. */
class FakeElement {
  parent: FakeElement | null = null;
  scrollHeight = 0;
  clientHeight = 0;
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Listener[]>();
  readonly children: FakeElement[] = [];
  constructor(readonly selectors: readonly string[] = []) {}

  append(...children: FakeElement[]) {
    for (const child of children) {
      child.parent = this;
      this.children.push(child);
    }
    return this;
  }
  matches(selector: string) {
    return this.selectors.includes(selector);
  }
  closest(selector: string): FakeElement | null {
    return this.matches(selector) ? this : (this.parent?.closest(selector) ?? null);
  }
  contains(other: FakeElement): boolean {
    return other === this || (other.parent !== null && this.contains(other.parent));
  }
  querySelector(selector: string): FakeElement | null {
    for (const child of this.children) {
      const found = child.matches(selector) ? child : child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  addEventListener(type: string, listener: Listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  removeEventListener(type: string, listener: Listener) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((each) => each !== listener),
    );
  }
}

/** An event at `target`, heard by every listener on its way down from the page. */
function fire(target: FakeElement, type: string, init: object = {}) {
  const event = { type, target, relatedTarget: null, ...init };
  for (let at: FakeElement | null = target; at; at = at.parent)
    for (const listener of at.listeners.get(type) ?? []) listener(event);
}

function setup() {
  const page = new FakeElement();
  const html = new FakeElement();
  const body = new FakeElement();
  const pane = new FakeElement();
  const transcript = new FakeElement([".messages-timeline-scroll"]);
  const row = new FakeElement();
  const marks = new FakeElement(['[data-testid="timeline-minimap"]']);
  const dash = new FakeElement();
  const composer = new FakeElement(['[data-chat-composer-overlay="true"]']);
  const field = new FakeElement();
  page.append(html.append(body.append(pane)));
  pane.append(transcript.append(row), marks.append(dash), composer.append(field));
  Object.assign(page, { body, documentElement: html });
  Object.assign(pane, { ownerDocument: page });
  pane.setAttribute("data-focused", "true");
  transcript.scrollHeight = 4000;
  transcript.clientHeight = 800;
  const stop = showMarksWhileScrolling(pane as unknown as HTMLElement);
  return {
    pane,
    body,
    transcript,
    row,
    marks,
    dash,
    field,
    stop,
    shown: () => marks.attributes.has(SHOWN),
  };
}

beforeEach(() => {
  vi.stubGlobal("Element", FakeElement);
  vi.stubGlobal("Node", FakeElement);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the chat's scroll marks", () => {
  it("show while the reader scrolls, and fade a glance after the last scroll", () => {
    const chat = setup();
    expect(chat.shown()).toBe(false);
    fire(chat.row, "wheel");
    fire(chat.transcript, "scroll");
    expect(chat.shown()).toBe(true);
    vi.advanceTimersByTime(300);
    fire(chat.row, "wheel");
    fire(chat.transcript, "scroll");
    vi.advanceTimersByTime(GLANCE - 1);
    expect(chat.shown()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(chat.shown()).toBe(false);
    chat.stop();
  });

  it("stay hidden while a reply the list follows to its end scrolls the chat", () => {
    const chat = setup();
    fire(chat.transcript, "scroll");
    expect(chat.shown()).toBe(false);
    // A wheel long gone doesn't make the next follow the reader's.
    fire(chat.row, "wheel");
    vi.advanceTimersByTime(400);
    fire(chat.transcript, "scroll");
    expect(chat.shown()).toBe(false);
    chat.stop();
  });

  it("never show in a chat too short to scroll", () => {
    const chat = setup();
    chat.transcript.scrollHeight = chat.transcript.clientHeight;
    fire(chat.row, "pointerdown");
    fire(chat.transcript, "scroll");
    expect(chat.shown()).toBe(false);
    chat.stop();
  });

  it("show for a key in the chat or on the page of the focused pane, never for one typed in the composer", () => {
    const chat = setup();
    fire(chat.field, "keydown");
    fire(chat.transcript, "scroll");
    expect(chat.shown()).toBe(false);
    fire(chat.body, "keydown");
    fire(chat.transcript, "scroll");
    expect(chat.shown()).toBe(true);
    vi.advanceTimersByTime(GLANCE);
    chat.pane.setAttribute("data-focused", "false");
    fire(chat.body, "keydown");
    fire(chat.transcript, "scroll");
    expect(chat.shown()).toBe(false);
    chat.stop();
  });

  it("stay a glance after the hand leaves them, not while it moves over them", () => {
    const chat = setup();
    fire(chat.dash, "pointerout", { relatedTarget: chat.marks });
    expect(chat.shown()).toBe(false);
    fire(chat.dash, "pointerout", { relatedTarget: chat.row });
    expect(chat.shown()).toBe(true);
    vi.advanceTimersByTime(GLANCE);
    expect(chat.shown()).toBe(false);
    chat.stop();
  });

  it("let go of the chat when the pane goes", () => {
    const chat = setup();
    fire(chat.row, "wheel");
    fire(chat.transcript, "scroll");
    chat.stop();
    expect(chat.shown()).toBe(false);
    fire(chat.row, "wheel");
    fire(chat.transcript, "scroll");
    expect(chat.shown()).toBe(false);
  });
});
