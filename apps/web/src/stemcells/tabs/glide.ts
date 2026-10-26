/**
 * A move of chats on stage, played as a glide (stemcells/tasks/chat-carry-polish.md): each pane
 * goes from where it stood to where it lands (`glide.css`). A view transition, so the compositor
 * moves the pictures and a long chat lays out once at its new size, never every frame. Under
 * Reduce Motion, or without view transitions, the move just happens.
 */
import { motionTiming, reducedMotion } from "../tokens/motion";
import { readWorkspace, useWorkspaceStore } from "./store";
import "./glide.css";

/** Marks the page while a glide plays, for `glide.css`. */
const GLIDING = "stemcellsGlide";

/** How long a move made elsewhere (the desktop app) may take to reach this window's tabs, ms. */
const ARRIVAL = 500;

/** The latest glide: one started over another ends that one, whose clean-up then leaves the names alone. */
let latest = 0;

/** The panes on stage, each named for the glide by its id. */
function nameOnStage(): void {
  for (const pane of document.querySelectorAll<HTMLElement>("[data-stemcells-pane]")) {
    if (pane.closest("[inert]") !== null) continue;
    const id = (pane.dataset.stemcellsPane ?? "").replaceAll(/[^\w-]/g, "_");
    pane.style.viewTransitionName = `sc-pane-${id}`;
    pane.style.viewTransitionClass = "sc-pane";
  }
}

function unname(): void {
  for (const pane of document.querySelectorAll<HTMLElement>("[data-stemcells-pane]")) {
    pane.style.removeProperty("view-transition-name");
    pane.style.removeProperty("view-transition-class");
  }
}

/** The tabs as they are now, once they change from `before`, or after `ARRIVAL` ms. */
function arrived(before: unknown): Promise<void> {
  if (readWorkspace() !== before) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      stop();
      resolve();
    };
    const timer = setTimeout(done, ARRIVAL);
    const stop = useWorkspaceStore.subscribe(() => {
      if (readWorkspace() !== before) done();
    });
  });
}

/**
 * Makes `move` (true when the chats moved) and glides the panes from where
 * they were to where it put them. Resolves, with whether they moved, once
 * the move is drawn and the glide starts.
 */
export async function glidePanes(move: () => Promise<boolean>): Promise<boolean> {
  if (reducedMotion() || typeof document.startViewTransition !== "function") return move();
  const root = document.documentElement;
  const { duration, easing } = motionTiming("land");
  root.style.setProperty("--sc-glide-duration", `${duration}ms`);
  root.style.setProperty("--sc-glide-easing", easing);
  root.dataset[GLIDING] = "";
  const glide = ++latest;
  nameOnStage();
  let moved = false;
  const transition = document.startViewTransition(async () => {
    const before = readWorkspace();
    moved = await move();
    if (!moved) return;
    await arrived(before);
    // React draws a change to the tabs in a microtask of its own: after it, the new picture.
    await new Promise((resolve) => setTimeout(resolve, 0));
    nameOnStage();
  });
  // A glide started over this one skips it: its promises reject, which is no error.
  transition.ready.catch(() => undefined);
  void transition.finished
    .catch(() => undefined)
    .then(() => {
      if (glide !== latest) return;
      unname();
      delete root.dataset[GLIDING];
    });
  // Rejects only when the move itself failed: a skipped glide still makes its move.
  await transition.updateCallbackDone;
  return moved;
}
