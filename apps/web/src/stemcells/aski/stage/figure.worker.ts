// Draws Aski off the main thread: work that can take more than a frame
// moves to a web worker.

import { drawFigure, type FigureAsk, type FigureDrawn } from "./figure.ts";

const scope = self as unknown as {
  addEventListener(type: "message", listener: (event: MessageEvent<FigureAsk>) => void): void;
  postMessage(message: FigureDrawn, transfer: Transferable[]): void;
};

scope.addEventListener("message", (event) => {
  const drawn = drawFigure(event.data);
  scope.postMessage(drawn, [drawn.pixels]);
});
