import { useEffect, useState } from "react";
import { type Activity, ActivityHold } from "./activity.ts";

/**
 * What a Cell shows of what it is doing: `raw` through `ActivityHold`, so a
 * new activity shows once it has lasted 3 s and a shown one stays 8 s, and
 * starting and stopping show at once. A change still pending is looked at
 * again when it falls due.
 */
export function useShownActivity(raw: Activity | undefined): Activity | undefined {
  const [hold] = useState(() => new ActivityHold());
  const [shown, setShown] = useState(raw);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const look = () => {
      const due = hold.update(raw, Date.now());
      setShown(hold.shown);
      if (due !== undefined) timer = setTimeout(look, Math.max(0, due - Date.now()));
    };
    look();
    return () => clearTimeout(timer);
  }, [hold, raw]);
  return shown;
}
