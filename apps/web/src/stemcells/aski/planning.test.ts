import { describe, expect, it } from "vite-plus/test";

import { readAskiPlans, setAskiPlans, type Shelf, subscribeAskiPlans } from "./planning";

function shelf(kept: string | null = null): Shelf & { kept: string | null } {
  const held = {
    kept,
    read: () => held.kept,
    write: (value: string | null) => {
      held.kept = value;
    },
  };
  return held;
}

// The switch a person turns off to stop Aski's planner calls: it must stay
// off once turned off, and nothing else may turn it off.
describe("Aski's planning switch", () => {
  it("is on until the person turns it off", () => {
    expect(readAskiPlans(shelf())).toBe(true);
  });

  it("stays off once turned off, and on again takes the value away", () => {
    const kept = shelf();
    setAskiPlans(false, kept);
    expect(readAskiPlans(kept)).toBe(false);
    setAskiPlans(true, kept);
    expect(kept.kept).toBeNull();
    expect(readAskiPlans(kept)).toBe(true);
  });

  it("reads anything else kept as on", () => {
    expect(readAskiPlans(shelf("false"))).toBe(true);
    expect(readAskiPlans(shelf(""))).toBe(true);
  });

  it("tells what reads it when it changes, until it lets go", () => {
    let heard = 0;
    const stop = subscribeAskiPlans(() => heard++);
    setAskiPlans(false, shelf());
    expect(heard).toBe(1);
    stop();
    setAskiPlans(true, shelf());
    expect(heard).toBe(1);
  });
});
