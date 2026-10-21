import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

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

function drawn(props: { cancelled: boolean; reset: number | null }, inPane = true) {
  const line = <CarriesOnLine {...props} />;
  return renderToStaticMarkup(
    inPane ? <PaneCellContext value={cell}>{line}</PaneCellContext> : line,
  );
}

describe("the line under the limit banner", () => {
  it("says the reset carries the Cell on, with the switch on and the reset ahead", () => {
    settings.autoResume = true;
    expect(drawn({ cancelled: false, reset: Date.now() + MINUTE })).toContain(CARRIES_ON);
  });

  it("is gone when nothing will carry the Cell on", () => {
    settings.autoResume = true;
    expect(drawn({ cancelled: true, reset: Date.now() + MINUTE })).toBe("");
    expect(drawn({ cancelled: false, reset: null })).toBe("");
    expect(drawn({ cancelled: false, reset: Date.now() - MINUTE })).toBe("");
    settings.autoResume = false;
    expect(drawn({ cancelled: false, reset: Date.now() + MINUTE })).toBe("");
  });

  it("is drawn only in a Cell's pane", () => {
    settings.autoResume = true;
    expect(drawn({ cancelled: false, reset: Date.now() + MINUTE }, false)).toBe("");
  });
});
