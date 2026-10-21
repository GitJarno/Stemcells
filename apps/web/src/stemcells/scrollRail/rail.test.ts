/**
 * The chat's scroll bar was the system's: on a Mac set to show scroll bars
 * always, a gray track the chat's whole height, under the pane's buttons
 * and past the composer. The rail that replaced it runs between the two;
 * this pins where its thumb stands and where a hand on it takes the chat.
 */
import { describe, expect, it } from "vite-plus/test";

import { scrollTopAt, shareAt, thumbOn, trackEnds } from "./rail";

const chat = (scrollTop: number) => ({ scrollTop, scrollHeight: 4000, clientHeight: 800 });

describe("the scroll rail's thumb", () => {
  it("is the viewport's share of the chat, standing where the viewport stands", () => {
    expect(thumbOn(chat(0), 500, 24)).toEqual({ length: 100, offset: 0 });
    expect(thumbOn(chat(1600), 500, 24)).toEqual({ length: 100, offset: 200 });
    expect(thumbOn(chat(3200), 500, 24)).toEqual({ length: 100, offset: 400 });
  });

  it("stands at the track's end at the chat's end, within a pixel of rounding", () => {
    expect(thumbOn(chat(3199.5), 500, 24)?.offset).toBe(400);
  });

  it("is never shorter than the least, however long the chat", () => {
    const long = { scrollTop: 0, scrollHeight: 400_000, clientHeight: 800 };
    expect(thumbOn(long, 500, 24)?.length).toBe(24);
  });

  it("is no rail at all when the chat fits, or there is no track", () => {
    expect(thumbOn({ scrollTop: 0, scrollHeight: 800, clientHeight: 800 }, 500, 24)).toBeNull();
    expect(thumbOn({ scrollTop: 0, scrollHeight: 800.5, clientHeight: 800 }, 500, 24)).toBeNull();
    expect(thumbOn(chat(0), 0, 24)).toBeNull();
  });
});

describe("a hand on the scroll rail", () => {
  it("takes the chat to where the thumb's top is put", () => {
    expect(scrollTopAt(0, 100, chat(0), 500)).toBe(0);
    expect(scrollTopAt(200, 100, chat(0), 500)).toBe(1600);
    expect(scrollTopAt(400, 100, chat(0), 500)).toBe(3200);
  });

  it("stops at the chat's ends past the track's", () => {
    expect(scrollTopAt(-50, 100, chat(800), 500)).toBe(0);
    expect(scrollTopAt(900, 100, chat(800), 500)).toBe(3200);
  });

  it("leaves the chat where it is when the thumb fills the track", () => {
    expect(scrollTopAt(10, 500, chat(800), 500)).toBe(800);
  });

  it("glides by its share of the way, which holds while rows measure on the way", () => {
    expect(shareAt(100, 100, 500)).toBe(0.25);
    expect(shareAt(-40, 100, 500)).toBe(0);
    expect(shareAt(480, 100, 500)).toBe(1);
    expect(shareAt(0, 500, 500)).toBeNull();
  });
});

describe("the scroll rail's track", () => {
  const pane = { top: 100, bottom: 900 };

  it("ends at the composer over the transcript's foot", () => {
    expect(trackEnds(pane, { top: 100, bottom: 900 }, 720)).toEqual({ head: 0, foot: 180 });
  });

  it("ends at the transcript's own box without a composer, or above one", () => {
    expect(trackEnds(pane, { top: 136, bottom: 860 }, null)).toEqual({ head: 36, foot: 40 });
    expect(trackEnds(pane, { top: 136, bottom: 600 }, 720)).toEqual({ head: 36, foot: 300 });
  });
});
