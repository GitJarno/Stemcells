import "./site.css";
import { hero } from "./hero.ts";

const stage = hero(document.querySelector<HTMLElement>("#hero")!);

// The Cells' art and the scenes load once Aski is up.
void import("./page.ts").then(({ page }) => page(stage));
