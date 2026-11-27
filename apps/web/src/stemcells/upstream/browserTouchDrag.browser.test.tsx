import { EnvironmentId } from "@t3tools/contracts";
import type {
  PreviewStreamEvents,
  PreviewStreamInput,
} from "@t3tools/client-runtime/preview/server-browser-stream";
import { describe, expect, it, vi } from "vite-plus/test";

import { act, render } from "../../../test/render";

// A finger on a remote page: where the probe says the point takes a drag (a slider), a drag
// is a mouse drag; anywhere else it scrolls the page (`stemcells/tasks/browser-column.md`).

const mocks = vi.hoisted(() => ({
  createClient: vi.fn<(target: unknown, handlers: PreviewStreamEvents) => unknown>(),
  sent: [] as PreviewStreamInput[],
  painted: null as (() => void) | null,
  access: { url: "ws://preview.test", token: "test" },
}));

vi.mock(import("@t3tools/client-runtime/preview/server-browser-stream"), async (original) => ({
  ...(await original()),
  createPreviewStreamClient: mocks.createClient as never,
  createPreviewFramePainter: (_canvas, onPainted) => {
    mocks.painted = onPainted ?? null;
    return { paint: () => undefined, stop: () => undefined };
  },
}));

vi.mock(import("~/state/previewStream"), async (original) => ({
  ...(await original()),
  usePreviewStreamAccess: () => mocks.access as never,
}));

import { ServerBrowserSurface } from "../../browser/ServerBrowserSurface";

async function controlledSurface() {
  mocks.sent.length = 0;
  mocks.createClient.mockReset().mockImplementation(() => ({
    send: (input: PreviewStreamInput) => mocks.sent.push(input),
    stop: () => undefined,
  }));
  const container = document.createElement("div");
  container.style.cssText = "width: 400px; height: 300px; display: flex;";
  const screen = await render(
    <ServerBrowserSurface
      environmentId={EnvironmentId.make("environment-drag")}
      threadId="thread-drag"
      tabId="tab-drag"
      visible
      followSize={false}
      className="flex-1"
    />,
    { container },
  );
  await vi.waitFor(() => expect(mocks.createClient).toHaveBeenCalled());
  const handlers = mocks.createClient.mock.calls.at(-1)![1];
  const canvas = container.querySelector("canvas")!;
  canvas.width = 400;
  canvas.height = 300;
  await act(() =>
    handlers.onControl?.({ canOperate: true, controller: "you", generation: 1, dialog: null }),
  );
  await act(() => {
    mocks.painted?.();
    handlers.onViewport({ width: 400, height: 300 });
  });
  mocks.sent.length = 0;
  const { left, top } = canvas.getBoundingClientRect();
  const finger = (type: "pointerdown" | "pointermove" | "pointerup", x: number, y: number) =>
    act(() => {
      canvas.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 7,
          pointerType: "touch",
          isPrimary: true,
          clientX: left + x,
          clientY: top + y,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
  const answerProbe = (drags: boolean) =>
    act(() => {
      const probe = mocks.sent.find((input) => input.type === "probe");
      if (probe?.type !== "probe") throw new Error("no probe was sent");
      handlers.onProbe?.({ x: probe.x, y: probe.y, editable: false, drags });
    });
  return { screen, finger, answerProbe };
}

const kinds = () =>
  mocks.sent.flatMap((input) =>
    input.type === "mouse" ? [`${input.action}:${input.buttons}`] : [input.type],
  );

describe("a touch drag on a remote page", () => {
  it("drags what takes a drag, even when the probe answers after the finger moved", async () => {
    const { screen, finger, answerProbe } = await controlledSurface();
    await using _screen = screen;
    await finger("pointerdown", 100, 50);
    await finger("pointermove", 140, 52);
    expect(kinds()).toEqual(["probe"]);

    await answerProbe(true);
    await finger("pointermove", 180, 52);
    await vi.waitFor(() =>
      expect(mocks.sent).toContainEqual(
        expect.objectContaining({ action: "move", x: 180, buttons: 1 }),
      ),
    );
    await finger("pointerup", 180, 52);

    const mouse = mocks.sent.filter((input) => input.type === "mouse");
    expect(kinds()).not.toContain("wheel");
    expect(mouse[0]).toMatchObject({ action: "move", x: 100, y: 50, buttons: 0 });
    expect(mouse[1]).toMatchObject({ action: "down", x: 100, y: 50, buttons: 1 });
    expect(mouse.at(-2)).toMatchObject({ action: "move", x: 180, buttons: 1 });
    expect(mouse.at(-1)).toMatchObject({ action: "up", x: 180, buttons: 0 });
  });

  it("scrolls the page where the point takes no drag", async () => {
    const { screen, finger, answerProbe } = await controlledSurface();
    await using _screen = screen;
    await finger("pointerdown", 100, 200);
    await answerProbe(false);
    await finger("pointermove", 100, 150);
    await finger("pointermove", 100, 100);
    const scrolled = () =>
      mocks.sent.reduce((sum, input) => sum + (input.type === "wheel" ? input.deltaY : 0), 0);
    await vi.waitFor(() => expect(scrolled()).toBe(100));
    await finger("pointerup", 100, 100);

    expect(new Set(kinds())).toEqual(new Set(["probe", "wheel"]));
  });
});
