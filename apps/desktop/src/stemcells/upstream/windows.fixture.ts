/**
 * Upstream's desktop app as the windows' host reads it (`windows.ts`), stood
 * in for the host's test.
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as SubscriptionRef from "effect/SubscriptionRef";

import * as DesktopEnvironment from "../../app/DesktopEnvironment.ts";
import * as DesktopState from "../../app/DesktopState.ts";
import * as ElectronWindow from "../../electron/ElectronWindow.ts";
import * as PreviewManager from "../../preview/Manager.ts";
import * as DesktopWindow from "../../window/DesktopWindow.ts";

export const windowsServices = Effect.fn("windowsServices")(function* (input: {
  readonly stateDir: string;
  /** Upstream's window maker, as `DesktopWindow.createExtra`. */
  readonly createExtra: unknown;
  /** Called with the window upstream is told is its main one. */
  readonly setMain: unknown;
  /** The app's own quitting flag. */
  readonly quitting: Ref.Ref<boolean>;
}) {
  return Layer.mergeAll(
    Layer.succeed(DesktopEnvironment.DesktopEnvironment, { stateDir: input.stateDir } as never),
    Layer.succeed(DesktopWindow.DesktopWindow, { createExtra: input.createExtra } as never),
    Layer.succeed(ElectronWindow.ElectronWindow, {
      setMain: input.setMain,
      reveal: () => Effect.void,
    } as never),
    Layer.succeed(PreviewManager.PreviewManager, {
      setMainWindow: () => Effect.void,
    } as never),
    Layer.succeed(DesktopState.DesktopState, {
      backendReady: yield* Ref.make(true),
      quitting: input.quitting,
      primaryBackendStartup: yield* SubscriptionRef.make<DesktopState.PrimaryBackendStartup>({
        _tag: "Ready",
      }),
    }),
  );
});
