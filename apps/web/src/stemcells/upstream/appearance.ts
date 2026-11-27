/** The frame a Cell is drawn on, from upstream's rendered appearance. */
import { useRenderedAppearance } from "../../hooks/useTheme";
import type { Ground } from "../cell/keyline";

/** Light while the app is drawn light (a theme preview too), else black: the two frames Cell art is judged on. */
export function useCellGround(): Ground {
  return useRenderedAppearance() === "light" ? "light" : "black";
}

/** The sky's palette (`motion/sky.ts`): light while the app is drawn light, else dark. */
export function useSkyScheme(): "light" | "dark" {
  return useRenderedAppearance() === "light" ? "light" : "dark";
}
