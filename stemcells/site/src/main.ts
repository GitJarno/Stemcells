import "./site.css";
import { hero } from "./hero.ts";

hero(document.querySelector<HTMLElement>("#hero")!);

// The acts carry the Cells' art; they load once the hero is up.
void import("./acts.ts").then(({ acts }) => acts());
