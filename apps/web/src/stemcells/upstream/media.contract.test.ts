// @effect-diagnostics nodeBuiltinImport:off - reads upstream's markup on disk.
/**
 * What the media viewer relies on in upstream: every thumbnail opens through
 * `openExpandedImagePreview`'s atom; a chat's timeline holds its pictures, videos and embedded
 * media; and an item built from the timeline names the thumbnail's file, so a click finds its
 * place in the reel. If one fails after a sync, `media.ts` follows upstream's new shape.
 */
import * as NodeFS from "node:fs";

import { classifyMarkdownImageSource } from "@t3tools/client-runtime/markdown-images";
import { resolveViewedImageAsset } from "@t3tools/client-runtime/work-log/presentation";
import { EnvironmentId, MessageId, PlanId, RunId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  expandedImagePreviewAtom,
  openExpandedImagePreview,
} from "../../components/chat/ExpandedImageDialog";
import { assetMediaActionsSource } from "../../components/chat/ChatMarkdownMedia";
import { buildAttachmentVideoPreview } from "../../components/chat/ExpandedImagePreview";
import { appAtomRegistry } from "../../rpc/atomRegistry";
import { chatReel, itemKey, reelAround, sameItem } from "../media/reel";
import {
  TIMELINE_ROW,
  attachedPictureResources,
  closeOpenedMedia,
  keybindingCaptureProps,
  markdownMediaSources,
  type ChatPlace,
  type TimelineEntries,
} from "./media";

const time = (second: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, second)).toISOString();

const place: ChatPlace = {
  environmentId: EnvironmentId.make("env-local"),
  threadId: ThreadId.make("thread-1"),
  cwd: "/Users/example/project",
};

const message = (
  id: string,
  role: "user" | "assistant",
  second: number,
  text: string,
  attachments?: unknown[],
  streaming = false,
) => ({
  kind: "message" as const,
  id,
  createdAt: time(second),
  message: {
    id: MessageId.make(id),
    role,
    text,
    runId: RunId.make("run-1"),
    createdAt: time(second),
    updatedAt: time(second),
    streaming,
    ...(attachments ? { attachments } : {}),
  },
});

const picture = (id: string, name: string, previewUrl?: string) => ({
  type: "image" as const,
  id,
  name,
  mimeType: "image/png",
  sizeBytes: 10,
  ...(previewUrl ? { previewUrl } : {}),
});

const video = (id: string, name: string) => ({
  type: "file" as const,
  id,
  name,
  mimeType: "video/mp4",
  sizeBytes: 10,
});

// A tool call that read a file, as the Claude and ACP adapters tag a picture's read.
const read = (id: string, second: number, path: string, status = "completed") => ({
  kind: "work" as const,
  id,
  createdAt: time(second),
  entry: {
    id,
    createdAt: time(second),
    label: "Read",
    toolTitle: "Read",
    tone: "tool",
    itemType: "dynamic_tool",
    toolLifecycleStatus: status,
    detail: path,
    ...(path.endsWith(".png") ? { viewedImagePath: path } : {}),
  },
});

const timeline = [
  message("u1", "user", 1, "Here is what I see ![sketch](shots/sketch.png)", [
    picture("a1", "screen.png", "blob:screen"),
    picture("a2", "stored.png"),
    picture("a3", "preview-annotation-1.png", "blob:annotation"),
    video("v1", "walkthrough.mp4"),
  ]),
  read("r1", 2, "/Users/example/project/out/viewed.png"),
  read("r2", 2, "/Users/example/project/notes.md"),
  read("r3", 2, "/Users/example/project/out/missing.png", "failed"),
  read("r4", 2, "/Users/example/project/out/viewed.png"),
  message(
    "c1",
    "assistant",
    2,
    [
      "The chart:",
      "",
      "![chart](out/chart.png)",
      "",
      '<img src="https://example.com/diagram.png" alt="diagram">',
      "",
      "![again][sketch]",
      "",
      "[sketch]: shots/sketch.png",
      "",
      "A [link to a picture](out/link.png) stays a link.",
      "",
      "```",
      "![not a picture](out/code.png)",
      "```",
    ].join("\n"),
  ),
  {
    kind: "proposed-plan" as const,
    id: "p1",
    createdAt: time(3),
    proposedPlan: {
      id: PlanId.make("plan-1"),
      runId: RunId.make("run-1"),
      planMarkdown: "1. Ship ![mock](mocks/next.png)",
      status: "proposed",
      createdAt: time(3),
      updatedAt: time(3),
    },
  },
] as unknown as TimelineEntries;

describe("opening a picture", () => {
  it("is upstream's atom, named by the chat, which our host reads and closes", () => {
    const preview = { images: [{ src: "blob:one", name: "one.png" }], index: 0 };
    openExpandedImagePreview("env:thread-1", preview);
    expect(appAtomRegistry.get(expandedImagePreviewAtom)).toEqual({
      threadKey: "env:thread-1",
      preview,
    });
    closeOpenedMedia("env:another");
    expect(appAtomRegistry.get(expandedImagePreviewAtom)).not.toBeNull();
    closeOpenedMedia("env:thread-1");
    expect(appAtomRegistry.get(expandedImagePreviewAtom)).toBeNull();
  });
});

describe("a chat's reel", () => {
  const reel = chatReel(timeline, place, (id) => (id === "a2" ? "https://local/a2" : undefined));

  it("holds each message's pictures, its videos, then what its text embeds, and the pictures its Cell viewed, in reading order, each once", () => {
    expect(reel.map((item) => item.name)).toEqual([
      "screen.png",
      "stored.png",
      "walkthrough.mp4",
      "sketch.png",
      "viewed.png",
      "chart.png",
      "diagram.png",
      "next.png",
    ]);
    expect(reel.map((item) => item.type ?? "image")).toEqual([
      "image",
      "image",
      "video",
      "image",
      "image",
      "image",
      "image",
      "image",
    ]);
  });

  it("names a picture the Cell viewed as its row's thumbnail does (a swipe skipped the tool's pictures)", () => {
    const viewed = reel.find((item) => item.name === "viewed.png")!;
    // `ViewedImagesTimelineRow` draws each path as `ChatMarkdownAssetImage` of this resource.
    expect(upstreamSource("components/chat/TimelineWorkEntryRow.tsx")).toMatch(
      /resolveViewedImageAsset\(path, \{\s*threadId: threadRef\.threadId,\s*workspaceRoot,\s*\}\)[\s\S]*?resource=\{image\.resource\}/,
    );
    const asset = resolveViewedImageAsset("/Users/example/project/out/viewed.png", {
      threadId: place.threadId,
      workspaceRoot: place.cwd,
    })!;
    const src = "https://local/viewed?token=1";
    const clicked = {
      src,
      name: asset.alt,
      actionsSource: assetMediaActionsSource({
        environmentId: place.environmentId,
        resource: asset.resource,
        kind: "image",
        name: asset.alt,
        src,
        workspaceRoot: place.cwd,
      }),
    };
    expect(reelAround(clicked, reel, [clicked]).index).toBe(reel.indexOf(viewed));
  });

  it("asks for the attached pictures the message rows resolve themselves", () => {
    // `blob:` previews are the row's own; stored pictures come from the server.
    expect(attachedPictureResources(timeline)).toEqual([
      { _tag: "attachment", attachmentId: "a2" },
    ]);
  });

  it("names a markdown picture's file as the chat's renderer asks for it", () => {
    const chart = reel.find((item) => item.name === "chart.png");
    const workspace = classifyMarkdownImageSource("out/chart.png", place.cwd);
    if (workspace._tag !== "WorkspaceFile") throw new Error("not a workspace file");
    // `ChatMarkdown`'s `ChatMarkdownAssetImage` resource: a relative path means this host's file.
    expect(workspace.relative).toBe(true);
    expect(chart?.actionsSource?.asset).toEqual({
      environmentId: place.environmentId,
      resource: {
        _tag: "media-file",
        threadId: place.threadId,
        path: workspace.path,
        hostOnly: true,
      },
    });
    expect(upstreamSource("components/ChatMarkdown.tsx")).toMatch(
      /resource=\{\{\s*_tag: "media-file",\s*threadId: threadRef\.threadId,\s*path: imageSource\.path,\s*\.\.\.\(imageSource\.relative \? \{ hostOnly: true as const \} : \{\}\),\s*\}\}/,
    );
    // The thumbnail registers this shape (`ChatMarkdownAssetImage`); the click carries it.
    const clicked = {
      src: "https://local/chart?token=1",
      name: "chart",
      actionsSource: {
        kind: "image" as const,
        name: "chart",
        src: "https://local/chart?token=1",
        asset: chart!.actionsSource!.asset!,
      },
    };
    expect(reelAround(clicked, reel, [clicked]).index).toBe(reel.indexOf(chart!));
  });

  it("names an attached video as its play button's click does", () => {
    const walkthrough = reel.find((item) => item.name === "walkthrough.mp4")!;
    const clicked = buildAttachmentVideoPreview(place.environmentId, {
      ...video("v1", "walkthrough.mp4"),
      type: "file",
    } as Parameters<typeof buildAttachmentVideoPreview>[1])!;
    expect(sameItem(clicked.images[0]!, walkthrough)).toBe(true);
  });

  it("finds an attached picture by the URL its thumbnail shows", () => {
    const clicked = { src: "https://local/a2", name: "stored.png" };
    expect(reelAround(clicked, reel, [clicked]).index).toBe(1);
  });

  it("keeps an attached picture's name as its URL is re-signed (the reel jumped to another picture)", () => {
    const resigned = chatReel(timeline, place, (id) =>
      id === "a2" ? "https://local/a2?v=2" : undefined,
    );
    expect(itemKey(resigned[1]!)).toBe(itemKey(reel[1]!));
    expect(reelAround(reel[1]!, resigned, []).index).toBe(1);
  });

  it("keeps a sent picture's name as its blob becomes the stored file and the server renames it", () => {
    const sending = chatReel(
      [
        message("u9", "user", 1, "", [picture("local-1", "screen.png", "blob:screen")]),
      ] as unknown as TimelineEntries,
      place,
      () => undefined,
    );
    const stored = chatReel(
      [message("u9", "user", 1, "", [picture("a9", "screen.png")])] as unknown as TimelineEntries,
      place,
      (id) => (id === "a9" ? "https://local/a9" : undefined),
    );
    expect(itemKey(stored[0]!)).toBe(itemKey(sending[0]!));
    expect(sameItem(stored[0]!, sending[0]!)).toBe(true);
  });

  it("acts on a sent picture by its blob until it is stored, then by the stored file (copy took a dead blob)", () => {
    const [sending] = chatReel(
      [
        message("u9", "user", 1, "", [picture("local-1", "screen.png", "blob:screen")]),
      ] as unknown as TimelineEntries,
      place,
      () => undefined,
    );
    expect(sending!.actionsSource).toMatchObject({ src: "blob:screen" });
    expect(sending!.actionsSource?.asset).toBeUndefined();
    const [stored] = chatReel(
      [message("u9", "user", 1, "", [picture("a9", "screen.png")])] as unknown as TimelineEntries,
      place,
      () => undefined,
    );
    expect(stored!.actionsSource?.asset?.resource).toEqual({
      _tag: "attachment",
      attachmentId: "a9",
    });
  });

  it("waits for a reply a Cell is still writing before reading its markdown", () => {
    const streaming = [
      message("c9", "assistant", 2, "![chart](out/chart.png)", undefined, true),
    ] as unknown as TimelineEntries;
    expect(chatReel(streaming, place, () => undefined)).toEqual([]);
  });
});

describe("markdown media", () => {
  it("reads image syntax, references and <img>, not links or code", () => {
    expect(
      markdownMediaSources(
        [
          "![a](one.png) and [b](two.png)",
          "",
          "![c][three]",
          "",
          "[three]: three.png",
          "",
          "<img src='four.png'>",
          "",
          "`![e](five.png)`",
        ].join("\n"),
      ),
    ).toEqual(["one.png", "three.png", "four.png"]);
  });
});

/** An upstream source file, as text: the markup the viewer leans on is written there. */
const upstreamSource = (path: string) =>
  NodeFS.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("upstream's markup", () => {
  it("marks each timeline row as the viewer looks for it (a picture flies home into the timeline)", () => {
    const attribute = TIMELINE_ROW.slice(1, -1);
    expect(upstreamSource("components/chat/MessagesTimeline.tsx")).toContain(`${attribute}={`);
  });

  it("lets the root shortcuts stand down for keys inside the viewer (⌘B folded the sidebar behind it)", () => {
    const [attribute] = Object.keys(keybindingCaptureProps);
    for (const file of [
      "components/AppSidebarLayout.tsx",
      "components/ReopenClosedViewShortcut.tsx",
    ]) {
      expect(upstreamSource(file)).toContain(`.closest("[${attribute}]")`);
    }
  });
});
