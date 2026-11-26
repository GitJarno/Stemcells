import { resolveViewedImageAsset } from "@t3tools/client-runtime/work-log/presentation";
import {
  EnvironmentId,
  MessageId,
  RunId,
  ThreadId,
  TurnItemId,
  type OrchestrationV2TurnItem,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { act, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vite-plus/test";

import { FilePreviewGallery } from "../../components/ui/FilePreviewGallery";
import type { FilePreviewSource } from "../../components/ui/FilePreviewModal.types";
import { messageImageGallery } from "../../features/threads/messageImageGallery";
import { filePreviewName, remoteAttachmentImageSource } from "../../lib/filePreviewGallery";
import { buildThreadFeed } from "../../lib/threadActivity";
import { ChatGallery } from "../chat/ChatGallery";
import { galleryAround } from "../chat/pictures";
import { useFilePreviewGallery } from "./substitutes/FilePreviewGallery";

/**
 * Contract: a chat's feed, as upstream builds it, holds its pictures in the order the feed draws
 * them, and a tap shaped as upstream's thumbnails shape theirs finds its place there. Upstream's
 * viewer paged through the tapped message's pictures alone, and a picture the Cell viewed had
 * none to page to.
 */

const environmentId = EnvironmentId.make("env-local");
const threadId = ThreadId.make("thread-1");
const runId = RunId.make("run-1");
const workspaceRoot = "/Users/example/project";
const place = { environmentId, threadId, workspaceRoot };

function base(id: string, ordinal: number) {
  const at = DateTime.makeUnsafe(`2026-06-20T00:00:${String(ordinal).padStart(2, "0")}.000Z`);
  return {
    id: TurnItemId.make(id),
    threadId,
    runId,
    nodeId: null,
    providerThreadId: null,
    providerTurnId: null,
    nativeItemRef: null,
    parentItemId: null,
    ordinal,
    status: "completed" as const,
    title: null,
    startedAt: at,
    completedAt: at,
    updatedAt: at,
  };
}

const picture = (id: string) => ({
  type: "image" as const,
  id,
  name: `${id}.png`,
  mimeType: "image/png",
  sizeBytes: 10,
});

const asked = (id: string, ordinal: number, attachments: ReturnType<typeof picture>[]) => ({
  ...base(id, ordinal),
  type: "user_message" as const,
  messageId: MessageId.make(id),
  createdBy: "user" as const,
  creationSource: "mobile" as const,
  inputIntent: "turn_start" as const,
  text: "Look at these",
  attachments,
});

// A file read, as the Claude and ACP adapters tag a picture's read even when it fails.
const read = (id: string, ordinal: number, path: string, status = "completed" as const) => ({
  ...base(id, ordinal),
  status,
  type: "dynamic_tool" as const,
  toolName: "Read",
  ...(path.endsWith(".png") ? { viewedImagePath: path } : {}),
  input: { file_path: path },
});

const answered = (id: string, ordinal: number, text: string) => ({
  ...base(id, ordinal),
  type: "assistant_message" as const,
  messageId: MessageId.make(id),
  text,
  streaming: false,
});

const items: OrchestrationV2TurnItem[] = [
  asked("ask-1", 0, [picture("first"), picture("second")]),
  read("read-1", 1, `${workspaceRoot}/out/viewed.png`),
  read("read-2", 2, `${workspaceRoot}/notes.md`),
  { ...read("read-3", 3, `${workspaceRoot}/out/missing.png`), status: "failed" },
  read("read-4", 4, `${workspaceRoot}/out/viewed.png`),
  answered(
    "answer-1",
    5,
    "Here: ![chart](out/chart.png) and ![diagram](https://example.com/d.png)",
  ),
  asked("ask-2", 6, [picture("third")]),
];
const feed = buildThreadFeed(
  items.map((item, position) => ({
    position,
    visibility: "local" as const,
    sourceThreadId: threadId,
    sourceItemId: item.id,
    item,
  })),
);

/** Taps `source` inside the chat, in a row whose own pictures are `row`, as the feed nests them. */
function tap(source: FilePreviewSource, row: ReturnType<typeof messageImageGallery> = []) {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const opened: FilePreviewSource[] = [];
  function Thumbnail() {
    const withGallery = useFilePreviewGallery();
    useLayoutEffect(() => void opened.push(withGallery(source)));
    return null;
  }
  const root = createRoot(document.createElement("div"));
  act(() =>
    root.render(
      <ChatGallery feed={feed} place={place}>
        <FilePreviewGallery value={row}>
          <Thumbnail />
        </FilePreviewGallery>
      </ChatGallery>,
    ),
  );
  act(() => root.unmount());
  const [tapped] = opened;
  return (tapped?.gallery ?? [tapped!]).map(filePreviewName);
}

const inChat = ["first.png", "second.png", "viewed.png", "chart.png", "d.png", "third.png"];

describe("a picture tapped in a chat", () => {
  it("pages through every picture the chat draws, in its order, each once", () => {
    const attached = remoteAttachmentImageSource(environmentId, "second", picture("second"));
    const ownRow = messageImageGallery(
      { text: "", attachments: [picture("first"), picture("second")] },
      place,
    );
    expect(tap({ ...attached, sourceIdentifier: "tile" }, ownRow)).toEqual(inChat);
  });

  it("pages from a picture the Cell viewed, tapped as its row opens it (it opened alone)", () => {
    const viewed = resolveViewedImageAsset(`${workspaceRoot}/out/viewed.png`, place)!;
    // `ThreadMarkdownImage`'s tap: its own fields, then the resource it draws.
    expect(
      tap({ kind: "image", name: "viewed.png", environmentId, resource: viewed.resource }),
    ).toEqual(inChat);
  });

  it("keeps the row's own list for a picture the chat doesn't hold yet (one still sending)", () => {
    const sending = { kind: "image" as const, uri: "file:///cache/sending.png" };
    const row = [{ kind: "image" as const, uri: "file:///cache/other.png" }, sending];
    expect(tap(sending, row)).toEqual(["other.png", "sending.png"]);
  });
});

describe("how far a long chat pages", () => {
  const chat = Array.from({ length: 9 }, (_, index) => ({
    kind: "image" as const,
    uri: `https://example.com/${index}.png`,
  }));
  const names = (from: number) =>
    galleryAround(chat[from]!, chat, 2)?.map((item) => ("uri" in item ? item.uri : ""));

  it("reaches as far either side of the tapped picture, fewer at the chat's ends", () => {
    expect(names(4)).toEqual([2, 3, 4, 5, 6].map((index) => `https://example.com/${index}.png`));
    expect(names(0)).toEqual([0, 1, 2].map((index) => `https://example.com/${index}.png`));
  });
});
