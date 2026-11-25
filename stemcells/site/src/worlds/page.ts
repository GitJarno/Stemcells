// One of the pages as a Cell hands it to the app (`html_render`): the rig bundles this into the
// page the real app shows and the pictures are taken of. It plays once, then stays alive.

import { clamp } from "../kit/form.ts";
import { cloud, type PageName, shapesOf } from "./shapes.ts";
import { Stage } from "./stage.ts";

const host = document.querySelector<HTMLElement>("[data-page]")!;
const COUNT = 40_000;
const stage = new Stage(COUNT);
host.append(stage.canvas, stage.words);
const shapes = [cloud(COUNT), ...shapesOf(host.dataset.page as PageName, COUNT)];
stage.shapes(shapes);

let tilt: [number, number] = [0, 0];
host.addEventListener("pointermove", (event) => {
  const box = host.getBoundingClientRect();
  tilt = [
    ((event.clientX - box.left) / box.width - 0.5) * 0.5,
    ((event.clientY - box.top) / box.height - 0.5) * 0.3,
  ];
});
const FORMS = 1.8,
  RESTS = 1.1;
/** A page's shape at `t` seconds: the cloud forms it, and a page with a second shape turns to it. */
function at(t: number): number {
  let along = clamp(t / FORMS);
  for (let n = 1; n < shapes.length - 1; n++)
    along += clamp((t - FORMS - (n - 1) * (FORMS + RESTS) - RESTS) / FORMS);
  // The page's layers stay apart: that is what it is for.
  return host.dataset.page === "page" ? Math.min(along, 1) : along;
}
const start = performance.now();
function frame(now: number): void {
  const { clientWidth: w, clientHeight: h } = host;
  stage.lay(w, h, Math.min(3, devicePixelRatio), { x: 0, y: 0, w, h });
  stage.draw(at((now - start) / 1000), (now - start) / 1000, tilt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
