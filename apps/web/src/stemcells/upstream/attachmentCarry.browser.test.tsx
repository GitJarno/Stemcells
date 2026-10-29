/**
 * Attachments carried between chats by a real drag (the browser's own, as the person's hand
 * makes it): a chip from upstream's composer strip and a picture a transcript shows, dropped on a
 * chat built with the drop handlers every chat spreads. Each case names what it keeps from going
 * wrong.
 */
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { type ReactNode, useState } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import { ComposerAttachmentMediaRow } from "../../components/chat/ComposerAttachmentStrip";
import type { ComposerImageAttachment } from "../../composerDraftStore";
import { MediaActions } from "./substitutes/MediaActions";
import { makeWorkspaceFileDropHandlers } from "./substitutes/workspaceFileDrop";
import { render } from "./testRender";

interface ChatDrops {
  readonly lit: boolean[];
  readonly added: File[][];
}

/** A chat's drop target as `ChatView` spreads it, or a sidebar row's as it marks its chat, with what it lit and took. */
function Chat(props: { id: string; drops: ChatDrops; row?: string; children?: ReactNode }) {
  const [active, setActive] = useState(false);
  const handlers = makeWorkspaceFileDropHandlers({
    setDragActive: (next) => {
      props.drops.lit.push(next);
      setActive(next);
    },
    addFiles: (files) => props.drops.added.push(files),
    addFolders: () => {},
  });
  return (
    <div
      data-testid={`chat-${props.id}`}
      data-thread-item={props.row}
      style={{ width: 320, height: 220, padding: 16 }}
      onDragEnter={handlers.onDragEnter}
      onDragOver={handlers.onDragOver}
      onDragLeave={handlers.onDragLeave}
      onDrop={handlers.onDrop}
    >
      {active ? <div data-chat-workspace-drop-overlay="true" /> : null}
      {props.children}
    </div>
  );
}

const newDrops = (): ChatDrops => ({ lit: [], added: [] });

const THREAD_A = scopeThreadRef("machine-here" as EnvironmentId, "thread-a" as ThreadId);

async function picture(name: string): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 8;
  canvas.getContext("2d")!.fillRect(0, 0, 8, 8);
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((png) => resolve(png!)));
  return new File([blob], name, { type: "image/png" });
}

function chip(file: File): ComposerImageAttachment {
  return {
    type: "image",
    id: "chip-1",
    name: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    previewUrl: URL.createObjectURL(file),
    file,
  };
}

function Composer(props: { image: ComposerImageAttachment }) {
  return (
    <ComposerAttachmentMediaRow
      images={[props.image]}
      expandedImages={[props.image]}
      preparingImages={[]}
      videos={[]}
      pendingSnapShotAnimations={[]}
      pendingSnapShotIds={[]}
      uncommittedSnapShotIds={[]}
      nonPersistedImageIds={[]}
      snapShotAnimations={false}
      supportsAttachmentUploads={false}
      maxFileAttachmentBytes={null}
      environmentId={"machine-here" as never}
      attachmentDraftTarget={THREAD_A}
      canOperateThread
      onExpandImage={() => {}}
      onFileOpen={() => {}}
      onRemoveImage={() => {}}
      onRemoveFile={() => {}}
    />
  );
}

describe("a composer's chip carried to another chat", () => {
  it("lands in that chat as the very file, and its own chat neither lights nor takes it", async () => {
    const file = await picture("sky.png");
    const own = newDrops();
    const other = newDrops();
    await using screen = await render(
      <div style={{ display: "flex", gap: 24 }}>
        <Chat id="b" drops={other} />
        <Chat id="a" drops={own}>
          <Composer image={chip(file)} />
        </Chat>
      </div>,
    );
    const tile = screen.getByRole("button", { name: "Preview Image 1" });

    // Back onto its own chat first: were it taken, it would land before the other chat's.
    await userEvent.dragAndDrop(tile, screen.getByTestId("chat-a"));
    await userEvent.dragAndDrop(tile, screen.getByTestId("chat-b"));

    await vi.waitFor(() => expect(other.added).toHaveLength(1));
    expect(other.added[0]).toEqual([file]);
    expect(other.added[0]![0]).toBe(file);
    expect(other.lit).toContain(true);
    expect(other.lit.at(-1)).toBe(false);
    expect(own.added).toEqual([]);
    expect(own.lit).not.toContain(true);
  });

  it("isn't taken by its own chat's row in the sidebar either", async () => {
    // The row would queue it for the chat that already has it.
    const file = await picture("sky.png");
    const row = newDrops();
    const other = newDrops();
    await using screen = await render(
      <div style={{ display: "flex", gap: 24 }}>
        <Chat id="row-a" drops={row} row={scopedThreadKey(THREAD_A)} />
        <Chat id="b" drops={other} />
        <Chat id="a" drops={newDrops()}>
          <Composer image={chip(file)} />
        </Chat>
      </div>,
    );
    const tile = screen.getByRole("button", { name: "Preview Image 1" });

    await userEvent.dragAndDrop(tile, screen.getByTestId("chat-row-a"));
    await userEvent.dragAndDrop(tile, screen.getByTestId("chat-b"));

    await vi.waitFor(() => expect(other.added).toHaveLength(1));
    expect(row.added).toEqual([]);
    expect(row.lit).not.toContain(true);
  });
});

describe("a picture a transcript shows, carried", () => {
  const url = () => new URL("/apple-touch-icon.png", location.href).href;
  const source = () => ({ kind: "image" as const, name: "icon.png", src: url() });

  it("is read from its address and lands as a file in the chat it's dropped on", async () => {
    const drops = newDrops();
    await using screen = await render(
      <div style={{ display: "flex", gap: 24 }}>
        <div data-timeline-row-id="row-1" style={{ width: 200 }}>
          <MediaActions source={source()}>
            <img src={url()} alt="icon" width={64} height={64} draggable={false} />
          </MediaActions>
        </div>
        <Chat id="b" drops={drops} />
      </div>,
    );

    await userEvent.dragAndDrop(
      screen.getByRole("img", { name: "icon" }),
      screen.getByTestId("chat-b"),
    );

    await vi.waitFor(() => expect(drops.added).toHaveLength(1));
    const [landed] = drops.added[0]!;
    expect(landed?.name).toBe("icon.png");
    expect(landed?.type).toBe("image/png");
    expect(landed?.size).toBeGreaterThan(0);
  });

  it("outside a transcript, stays put as upstream drew it", async () => {
    // The file viewer and dialogs pan a picture with the same press.
    const drops = newDrops();
    await using screen = await render(
      <div style={{ display: "flex", gap: 24 }}>
        <div style={{ width: 200 }}>
          <MediaActions source={source()}>
            <img src={url()} alt="outside" width={64} height={64} draggable={false} />
          </MediaActions>
        </div>
        <Chat id="b" drops={drops} />
      </div>,
    );

    await userEvent.dragAndDrop(
      screen.getByRole("img", { name: "outside" }),
      screen.getByTestId("chat-b"),
    );

    // A carry over the chat would have lit it as it crossed, before the drop.
    expect(drops.lit).toEqual([]);
    expect(drops.added).toEqual([]);
  });
});

describe("a video a reply plays, carried", () => {
  const url = () => new URL("/apple-touch-icon.png", location.href).href;

  it("goes from its picture, while a press on its controls stays the player's", async () => {
    // A reply's player has its controls on, over all of it.
    const drops = newDrops();
    await using screen = await render(
      <div style={{ display: "flex", gap: 24 }}>
        <div data-timeline-row-id="row-1" style={{ width: 240 }}>
          <MediaActions source={{ kind: "video", name: "clip.mp4", src: url() }}>
            <span style={{ display: "inline-block" }}>
              <video controls src={url()} aria-label="clip" style={{ width: 240, height: 180 }} />
            </span>
          </MediaActions>
        </div>
        <Chat id="b" drops={drops} />
      </div>,
    );
    const video = screen.getByLabelText("clip");

    await userEvent.dragAndDrop(video, screen.getByTestId("chat-b"), {
      sourcePosition: { x: 120, y: 172 },
    });
    expect(drops.lit).toEqual([]);

    await userEvent.dragAndDrop(video, screen.getByTestId("chat-b"), {
      sourcePosition: { x: 120, y: 60 },
    });
    await vi.waitFor(() => expect(drops.added).toHaveLength(1));
    expect(drops.added[0]![0]?.name).toBe("clip.mp4");
  });
});
