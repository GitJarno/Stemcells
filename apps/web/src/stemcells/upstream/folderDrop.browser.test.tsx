import "./appStyles";
import "../tokens/stemcells.css";

import { describe, expect, it, vi } from "vite-plus/test";

import { LeftColumn } from "../rail/LeftColumn";
import { useColumnStore } from "../rail/column";
import { act, render } from "./testRender";

const spies = vi.hoisted(() => ({ open: vi.fn(async () => ({ ok: true })) }));

vi.mock("../../hooks/useOpenLocalWorkspace", () => ({
  useOpenLocalWorkspace: () => ({ ready: true, open: spies.open }),
}));
vi.mock("./ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./ui")>()),
  useSidebar: () => ({ open: true, isMobile: false }),
}));
vi.mock("../zoom/useZoomNotice", () => ({ useZoomNotice: () => undefined }));
vi.mock("../rail/Cells", () => ({ Cells: () => <div data-stemcells-cells="" /> }));
vi.mock("../rail/Rail", () => ({ Rail: () => <div data-stemcells-rail="" /> }));

const FOLDER = "/home/person/website";

/** A folder from the disk, as the OS file manager carries it. */
function folderDrag(type: "dragover" | "drop") {
  const folder = new File([], "website");
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", {
    value: {
      types: ["Files"],
      files: [folder],
      items: [
        { kind: "file", getAsFile: () => folder, webkitGetAsEntry: () => ({ isDirectory: true }) },
      ],
      dropEffect: "none",
    },
  });
  return event;
}

function stubDesktop() {
  const before = window.desktopBridge;
  Object.assign(window, {
    desktopBridge: { getClientPlatform: () => "darwin", getPathForFile: () => FOLDER },
  });
  return { [Symbol.dispose]: () => Object.assign(window, { desktopBridge: before }) };
}

// Upstream's list carries its own drop zone (`components/Sidebar.tsx`); the Cells' column and
// the rail stand in the same one, its picture in our tokens (`rail/folderDrop.css`).
describe("a folder dropped on the left column", () => {
  it.each(["cells", "rail"] as const)("is added as a project from the %s", async (width) => {
    spies.open.mockClear();
    useColumnStore.setState({ width });
    using _desktop = stubDesktop();
    await using screen = await render(<LeftColumn wide={<div data-testid="list" />} />);
    const column = screen.container.querySelector<HTMLElement>(`[data-stemcells-${width}]`)!;

    await act(async () => column.dispatchEvent(folderDrag("dragover")));
    const picture = column.nextElementSibling as HTMLElement;
    expect(picture.getAttribute("aria-hidden")).not.toBeNull();
    expect(getComputedStyle(picture).borderTopWidth).toBe("1px");

    await act(async () => column.dispatchEvent(folderDrag("drop")));
    expect(column.nextElementSibling).toBeNull();
    expect(spies.open).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        type: "open-workspace",
        workspaceRoot: FOLDER,
        platform: "darwin",
      }),
    );
  });
});
