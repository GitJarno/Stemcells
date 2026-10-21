/**
 * How a lit surface can be seen, so its light costs what that needs and no
 * more. A wave costs the display a frame each time it moves, seen or not.
 *
 * - `hidden`: no one can see it move. Its window is minimised, hidden or
 *   fully covered (Chromium's occlusion hides the page), or the surface is
 *   off screen: the tab pager keeps a tab's neighbours mounted beside the
 *   window. The light holds, and rejoins the beat where the beat is.
 * - `unfocused`: the window shows, but another app has the focus, as when
 *   it stands beside an editor. The light keeps moving, as a frozen wave
 *   reads as a stalled Cell, but steps on the Cells' sprite clock, twelve
 *   times a second, on the same beat.
 * - `focused`: the window is the one in use and the surface is on screen.
 *
 * The window counts as in use while its page or anything inside it (a
 * browser pane's page) has focus: a `blur` is checked once focus has
 * landed, so moving into a frame of the window's own is no blur.
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
