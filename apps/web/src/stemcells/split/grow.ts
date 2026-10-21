import { reducedMotion, timed } from "../tokens/motion";
import type { Axis, Sides } from "./Separator";
import type { Lengths } from "./split";

/** An element's length along the axis, without its borders: what its grow shares out. */
function lengthOf(element: HTMLElement, axis: Axis): number {
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return axis === "x"
    ? rect.width - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth)
    : rect.height - parseFloat(style.borderTopWidth) - parseFloat(style.borderBottomWidth);
}

function neighboursOf(separator: HTMLElement): [HTMLElement, HTMLElement] | null {
  const before = separator.previousElementSibling;
  const after = separator.nextElementSibling;
  return before instanceof HTMLElement && after instanceof HTMLElement ? [before, after] : null;
}

const growOf = (element: HTMLElement) =>
  parseFloat(element.style.flexGrow || getComputedStyle(element).flexGrow);

const glides = new WeakMap<Element, number>();

/**
 * Evened out, a parent's children glide there on `settle` (Reduce Motion:
 * they snap). How long they glide, in ms.
 */
function glide(parent: Element): number {
  clearTimeout(glides.get(parent));
  if (reducedMotion()) return 0;
  const { duration } = timed("settle");
  parent.setAttribute("data-stemcells-split-glide", "");
  const done = window.setTimeout(() => {
    parent.removeAttribute("data-stemcells-split-glide");
    glides.delete(parent);
  }, duration);
  glides.set(parent, done);
  return duration;
}

/**
 * The sides of a border in a flex row or column whose children grow by
 * their shares: the border's element siblings, which it lays out by their
 * grow, the pair's grow shared as their lengths are.
 */
export function growSides(
  axis: Axis,
  floors: readonly [number, number],
  keep: (lengths: Lengths) => void,
  even: () => void,
): Sides {
  return {
    measure(separator) {
      const neighbours = neighboursOf(separator);
      if (neighbours === null) return null;
      // A drag takes over from a glide where it stands.
      const parent = separator.parentElement;
      if (parent?.hasAttribute("data-stemcells-split-glide")) {
        clearTimeout(glides.get(parent));
        parent.removeAttribute("data-stemcells-split-glide");
      }
      return {
        before: lengthOf(neighbours[0], axis),
        after: lengthOf(neighbours[1], axis),
        floorBefore: floors[0],
        floorAfter: floors[1],
      };
    },
    lay(separator, lengths) {
      const neighbours = neighboursOf(separator);
      if (neighbours === null) return;
      const [before, after] = neighbours;
      const pair = growOf(before) + growOf(after);
      const total = lengths.before + lengths.after;
      before.style.flexGrow = String((pair * lengths.before) / total);
      after.style.flexGrow = String((pair * lengths.after) / total);
    },
    keep,
    even(separator) {
      const gliding = separator.parentElement ? glide(separator.parentElement) : 0;
      even();
      return gliding;
    },
  };
}
