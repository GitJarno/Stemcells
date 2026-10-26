import { useEffect, useState } from "react";

/** The time, read again each minute: what the rail shows changes on the minute at most. */
export function useMinute(): number {
  const [now, setNow] = useState(() => Date.now());
  // oxlint-disable-next-line t3code/react-effect-budget -- Read the time again each minute and clear the interval on unmount.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
