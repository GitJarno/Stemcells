/**
 * What more than one window takes from upstream's desktop app
 * (stemcells/tasks/windows.md): the state folder the windows' file lives
 * in, its window maker (`createExtra`, our seam in
 * `window/DesktopWindow.ts`), its main window and its quitting flag.
 */
import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";
import type * as Electron from "electron";

import * as DesktopEnvironment from "../../app/DesktopEnvironment.ts";
import * as DesktopState from "../../app/DesktopState.ts";
import * as ElectronWindow from "../../electron/ElectronWindow.ts";
import * as PreviewManager from "../../preview/Manager.ts";
import * as DesktopWindow from "../../window/DesktopWindow.ts";

export const windowsHost = Effect.gen(function* () {
  const environment = yield* DesktopEnvironment.DesktopEnvironment;
  const desktopWindow = yield* DesktopWindow.DesktopWindow;
  const electronWindow = yield* ElectronWindow.ElectronWindow;
  const previewManager = yield* PreviewManager.PreviewManager;
  const desktopState = yield* DesktopState.DesktopState;

  return {
    stateDir: environment.stateDir,
    /** One more app window at its bounds; undefined where upstream's maker has none. */
    createExtra: desktopWindow.createExtra,
    /** Makes `window` upstream's main one: its menu, reload and browser previews act there. */
    setMain: (window: Electron.BrowserWindow) =>
      electronWindow
        .setMain(window)
        .pipe(Effect.andThen(previewManager.setMainWindow(window)), Effect.ignore),
    reveal: electronWindow.reveal,
    /** The app's own quitting flag, as it stands now. */
    quitting: () => Ref.getUnsafe(desktopState.quitting),
  };
});
