import { useEffect, useState } from "react";

/** Whether `element` is on screen and its page in sight. */
export function useShown(element: { readonly current: Element | null }): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const target = element.current;
    if (target === null) return;
    let inView = false;
    const decide = (): void => setShown(inView && !document.hidden);
    const seen = new IntersectionObserver((entries) => {
      inView = entries.at(-1)?.isIntersecting ?? inView;
      decide();
    });
    seen.observe(target);
    document.addEventListener("visibilitychange", decide);
    return () => {
      seen.disconnect();
      document.removeEventListener("visibilitychange", decide);
    };
  }, [element]);
  return shown;
}
