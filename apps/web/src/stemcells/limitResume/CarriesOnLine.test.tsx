import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { PaneCellContext } from "../tabs/paneCell";
import { CARRIES_ON, CarriesOnLine } from "./LimitActions";

/**
 * The line under a stopped Cell's limit banner, drawn: it says the reset
 * carries the Cell on only while that is true, so a person never reads it
 * over a Cell nothing will carry on.
 */

const settings = vi.hoisted(() => ({ autoResume: true }));
vi.mock("../upstream/limitResume", () => ({ useAutoResume: () => settings.autoResume }));

const cell = { environmentId: "env-otter", threadId: "thread-otter", draftId: null };
const MINUTE = 60_000;
const NOW = Date.UTC(2026, 9, 21, 12);

function drawn(props: { cancelled: boolean; reset: number | null }, inPane = true) {
  const line = <CarriesOnLine {...props} />;
  return renderToStaticMarkup(
    inPane ? <PaneCellContext value={cell}>{line}</PaneCellContext> : line,
  );
}

describe("the line under the limit banner", () => {
  beforeEach(() => vi.setSystemTime(NOW));
  afterEach(() => vi.useRealTimers());

  it("says the reset carries the Cell on, with the switch on and the reset ahead", () => {
    settings.autoResume = true;
    expect(drawn({ cancelled: false, reset: NOW + MINUTE })).toContain(CARRIES_ON);
  });

  it("is gone when nothing will carry the Cell on", () => {
    settings.autoResume = true;
    expect(drawn({ cancelled: true, reset: NOW + MINUTE })).toBe("");
    expect(drawn({ cancelled: false, reset: null })).toBe("");
    expect(drawn({ cancelled: false, reset: NOW - MINUTE })).toBe("");
    settings.autoResume = false;
    expect(drawn({ cancelled: false, reset: NOW + MINUTE })).toBe("");
  });

  it("is drawn only in a Cell's pane", () => {
    settings.autoResume = true;
    expect(drawn({ cancelled: false, reset: NOW + MINUTE }, false)).toBe("");
  });
});
