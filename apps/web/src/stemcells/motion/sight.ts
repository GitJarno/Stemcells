/**
 * How a lit surface can be seen, so its light costs no more than that needs: `hidden` (window
 * minimised or covered, or surface off screen) holds it; `unfocused` (another app has focus)
 * steps it on the sprite clock, as a frozen wave reads as a stalled Cell; `focused` runs it.
 * A `blur` is checked once focus lands, so focus moving into the window's own frame is no blur.
 */

export type Sight = "hidden" | "unfocused" | "focused";

type Change = (sight: Sight) => void;

interface Watcher {
  readonly change: Change;
  last: Sight | undefined;
}

/** Each watched element: whether it is on screen, and who is told. */
const watched = new Map<Element, { onScreen: boolean; readonly watchers: Set<Watcher> }>();
let observer: IntersectionObserver | null = null;
let focused = true;

function tell(onScreen: boolean, watcher: Watcher): void {
  const sight: Sight =
    !onScreen || document.visibilityState !== "visible"
      ? "hidden"
      : focused
        ? "focused"
        : "unfocused";
  if (sight === watcher.last) return;
  watcher.last = sight;
  watcher.change(sight);
}

function tellAll(): void {
  for (const { onScreen, watchers } of watched.values()) {
    for (const watcher of watchers) tell(onScreen, watcher);
  }
}

const onFocus = () => {
  focused = true;
  tellAll();
};
const onBlur = () => {
  // Focus moving into a frame of this page blurs the window first.
  setTimeout(() => {
    focused = document.hasFocus();
    tellAll();
  });
};

function listen(): void {
  focused = document.hasFocus();
  window.addEventListener("focus", onFocus);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", tellAll);
  observer = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      const element = watched.get(target);
      if (element === undefined) continue;
      element.onScreen = isIntersecting;
      for (const watcher of element.watchers) tell(isIntersecting, watcher);
    }
  });
}

function unlisten(): void {
  window.removeEventListener("focus", onFocus);
  window.removeEventListener("blur", onBlur);
  document.removeEventListener("visibilitychange", tellAll);
  observer?.disconnect();
  observer = null;
}

/**
 * Tells `change` how `element` can be seen, once that is known and each
 * time it changes; the return stops telling. An element counts as off
 * screen until the first look at the screen says otherwise.
 */
export function watchSight(element: Element, change: Change): () => void {
  if (watched.size === 0) listen();
  let entry = watched.get(element);
  if (entry === undefined) {
    entry = { onScreen: false, watchers: new Set() };
    watched.set(element, entry);
    observer?.observe(element);
  }
  const watcher: Watcher = { change, last: undefined };
  entry.watchers.add(watcher);
  if (entry.onScreen) tell(true, watcher);
  return () => {
    const current = watched.get(element);
    if (current === undefined || !current.watchers.delete(watcher)) return;
    if (current.watchers.size > 0) return;
    watched.delete(element);
    observer?.unobserve(element);
    if (watched.size === 0) unlisten();
  };
}
