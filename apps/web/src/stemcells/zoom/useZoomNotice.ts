import { useEffect } from "react";

import "../tokens/stemcells.css";
import { showZoomLevel } from "../upstream/zoomNotice";
import "./zoom.css";
import { followZoom, type ZoomView } from "./zoomLevel";

const view = (): ZoomView => ({
  appZoomFactor: window.desktopBridge?.getWindowZoomFactor?.(),
  outerWidth: window.outerWidth,
  innerWidth: window.innerWidth,
  devicePixelRatio: window.devicePixelRatio,
});

/** Shows the zoom level whenever the page's zoom changes, however it was changed. */
export function useZoomNotice(): void {
  // oxlint-disable-next-line t3code/react-effect-budget -- Follow resizes and pixel-ratio changes to show the zoom level; remove listeners on unmount.
  useEffect(() => {
    const follow = followZoom(view());
    // A zoom is a resize; a browser's also moves the pixel ratio, which may
    // land after the resize, so a change of ratio is heard too.
    let ratio: MediaQueryList | null = null;
    const onChange = () => {
      const level = follow(view());
      if (level !== null) showZoomLevel(level);
      ratio?.removeEventListener("change", onChange);
      ratio = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      ratio.addEventListener("change", onChange);
    };
    ratio = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    ratio.addEventListener("change", onChange);
    window.addEventListener("resize", onChange);
    return () => {
      window.removeEventListener("resize", onChange);
      ratio?.removeEventListener("change", onChange);
    };
  }, []);
}
