// The home's one undo line (`held.ts`): an answer's (`LineHome.tsx`) and a hidden disk
// notice's (`disk/DiskPlate.tsx`).

import { sendThreadCommand } from "../upstream/needs";
import { createHeld } from "./held";
import { readMachine } from "./readings";

export const held = createHeld({
  send: sendThreadCommand,
  stillAsks: async (act) => {
    const reading = await readMachine(act.environmentId);
    if (reading?.state !== "read") return null;
    return reading.list.needs.some((need) => `${act.environmentId}:${need.key}` === act.key);
  },
  after: (ms, then) => {
    const timer = setTimeout(then, ms);
    return () => clearTimeout(timer);
  },
  now: Date.now,
});
