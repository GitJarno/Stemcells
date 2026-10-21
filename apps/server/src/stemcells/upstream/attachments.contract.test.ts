// @effect-diagnostics nodeBuiltinImport:off - the files are written and aged on disk.
/**
 * What carrying a file into another chat relies on in upstream's attachment
 * store. A carried file is a pending attachment of its own, made by
 * `pendingFile`: if upstream stops recognising those ids, a sent message
 * can't claim the file, or the sweep leaves it forever. A chat's signed
 * asset URL must still read back to the file it names, and to nothing else.
 * And the HTML renderer's check must still refuse every address that isn't
 * public, or a web address brought in could reach this machine's network.
 */
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as NodeHttpPlatform from "@effect/platform-node/NodeHttpPlatform";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { afterEach } from "vite-plus/test";

import { ASSET_ROUTE_PREFIX, issueAssetUrl } from "../../assets/AssetAccess.ts";
import * as NativeAppIconResolver from "../../assets/NativeAppIconResolver.ts";
import {
  parseThreadSegmentFromAttachmentId,
  planAttachmentClaim,
  resolveAttachmentPathById,
  sweepStalePendingAttachments,
} from "../../attachmentStore.ts";
import * as ServerSecretStore from "../../auth/ServerSecretStore.ts";
import * as ServerConfig from "../../config.ts";
import * as Orchestrator from "../../orchestration-v2/Orchestrator.ts";
import * as ProjectFaviconResolver from "../../project/ProjectFaviconResolver.ts";
import * as T3ProjectFileLoader from "../../project/T3ProjectFileLoader.ts";
import * as WorkspacePaths from "../../workspace/WorkspacePaths.ts";
import {
  pendingBytes,
  pendingFile,
  publicAddresses,
  withAssetFile,
  type AssetFile,
} from "./attachments.ts";

const dirs: string[] = [];
const freshDir = () => {
  const dir = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "stemcells-carry-contract-"));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) NodeFS.rmSync(dir, { recursive: true, force: true });
});

describe("a carried file's pending attachment", () => {
  it("is one upstream claims for the thread its message is sent in", () => {
    const attachmentsDir = freshDir();
    for (const name of ["clip.mp4", "notes", "archive.part"]) {
      const made = pendingFile(attachmentsDir, name);
      if (made === null) throw new Error(`No place for ${name}`);
      NodeFS.writeFileSync(made.path, "bytes");
      expect(parseThreadSegmentFromAttachmentId(made.attachmentId)).toBe("pending");
      expect(resolveAttachmentPathById({ attachmentsDir, attachmentId: made.attachmentId })).toBe(
        made.path,
      );
      expect(
        planAttachmentClaim({
          attachmentsDir,
          threadId: "thread-1",
          attachmentId: made.attachmentId,
        }),
      ).toMatchObject({ ok: true, currentPath: made.path });
    }
  });

  it("is swept a day after it was written, and a copy left half-made after an hour", () => {
    const attachmentsDir = freshDir();
    const made = pendingFile(attachmentsDir, "clip.mp4");
    if (made === null) throw new Error("No place for clip.mp4");
    NodeFS.writeFileSync(made.path, "bytes");
    // The part file `store` writes through, named as it names them.
    const part = `${made.path}.00000000-0000-4000-8000-000000000001.part`;
    NodeFS.writeFileSync(part, "half");
    const now = NodeFS.statSync(made.path).mtimeMs;
    const HOUR = 60 * 60 * 1000;
    expect(sweepStalePendingAttachments({ attachmentsDir, nowMs: now })).toEqual({ deleted: 0 });
    expect(sweepStalePendingAttachments({ attachmentsDir, nowMs: now + 2 * HOUR })).toEqual({
      deleted: 1,
    });
    expect(NodeFS.existsSync(part)).toBe(false);
    expect(NodeFS.existsSync(made.path)).toBe(true);
    expect(sweepStalePendingAttachments({ attachmentsDir, nowMs: now + 25 * HOUR })).toEqual({
      deleted: 1,
    });
    expect(NodeFS.existsSync(made.path)).toBe(false);
  });
});

const layerConfig = ServerConfig.ServerConfig.layerTest(process.cwd(), {
  prefix: "stemcells-carry-asset-",
});
const layerAssets = Layer.mergeAll(
  NodeHttpPlatform.layer,
  Layer.mock(Orchestrator.OrchestratorV2)({ getTurnItem: () => Effect.succeed(null) }),
  layerConfig,
  WorkspacePaths.layer,
  ProjectFaviconResolver.layer.pipe(
    Layer.provide(WorkspacePaths.layer),
    Layer.provide(T3ProjectFileLoader.layer),
  ),
  NativeAppIconResolver.layer.pipe(Layer.provide(layerConfig)),
  ServerSecretStore.layer.pipe(Layer.provide(layerConfig)),
).pipe(Layer.provideMerge(NodeServices.layer));

const readAll = (file: AssetFile) =>
  new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    file
      .open()
      .on("data", (chunk: Buffer) => chunks.push(chunk))
      .on("end", () => resolve(Buffer.concat(chunks).toString()))
      .on("error", reject);
  });

describe("a chat's signed asset URL", () => {
  it.effect("reads back to the media file a Cell showed, by its name and type", () =>
    Effect.gen(function* () {
      const dir = freshDir();
      const filePath = NodePath.join(dir, "recording.mp4");
      NodeFS.writeFileSync(filePath, "a video");
      const { relativeUrl } = yield* issueAssetUrl({
        resource: { _tag: "media-file", threadId: ThreadId.make("thread-1"), path: filePath },
        workspaceRoot: dir,
      });
      expect(relativeUrl.startsWith(`${ASSET_ROUTE_PREFIX}/`)).toBe(true);
      const seen = yield* withAssetFile(`http://127.0.0.1:3773${relativeUrl}`, async (file) => ({
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        bytes: await readAll(file),
      }));
      expect(seen).toEqual({
        name: "recording.mp4",
        mimeType: "video/mp4",
        size: 7,
        bytes: "a video",
      });
    }).pipe(Effect.provide(layerAssets)),
  );

  it.effect("reads the file it opened, though another takes its place meanwhile", () =>
    Effect.gen(function* () {
      const config = yield* ServerConfig.ServerConfig;
      NodeFS.mkdirSync(config.attachmentsDir, { recursive: true });
      const attachmentId = "thread-1-00000000-0000-4000-8000-000000000003-pdf";
      const stored = NodePath.join(config.attachmentsDir, `${attachmentId}.pdf`);
      NodeFS.writeFileSync(stored, "the one signed for");
      const { relativeUrl } = yield* issueAssetUrl({
        resource: { _tag: "attachment", attachmentId, fileName: "report.pdf" },
      });
      const read = yield* withAssetFile(relativeUrl, async (file) => {
        NodeFS.renameSync(stored, `${stored}.moved`);
        NodeFS.writeFileSync(stored, "another file");
        return readAll(file);
      });
      expect(read).toBe("the one signed for");
    }).pipe(Effect.provide(layerAssets)),
  );

  it.effect("reads back to a stored attachment, and to nothing once tampered with", () =>
    Effect.gen(function* () {
      const config = yield* ServerConfig.ServerConfig;
      NodeFS.mkdirSync(config.attachmentsDir, { recursive: true });
      const attachmentId = "thread-1-00000000-0000-4000-8000-000000000002-pdf";
      NodeFS.writeFileSync(NodePath.join(config.attachmentsDir, `${attachmentId}.pdf`), "report");
      const { relativeUrl } = yield* issueAssetUrl({
        resource: { _tag: "attachment", attachmentId, fileName: "report.pdf" },
      });
      const read = (url: string) => withAssetFile(url, readAll);
      expect(yield* read(relativeUrl)).toBe("report");
      const suffix = relativeUrl.slice(`${ASSET_ROUTE_PREFIX}/`.length);
      const separator = suffix.indexOf("/");
      const token = suffix.slice(0, separator);
      expect(yield* read(`${ASSET_ROUTE_PREFIX}/${token}x/report.pdf`)).toBeNull();
      expect(yield* read(`${ASSET_ROUTE_PREFIX}/not-a-token/report.pdf`)).toBeNull();
      expect(yield* read("/api/elsewhere/report.pdf")).toBeNull();
    }).pipe(Effect.provide(layerAssets)),
  );
});

describe("an address a web import may reach", () => {
  it("is never this machine, its networks, link-local or a cloud's metadata address", async () => {
    for (const address of [
      "127.0.0.1",
      "::1",
      "10.1.2.3",
      "172.16.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "fe80::1",
      "fc00::1",
      "64:ff9b::7f00:1",
      "localhost",
    ])
      expect(await publicAddresses(address)).toBeUndefined();
    for (const own of Object.values(NodeOS.networkInterfaces()).flat())
      if (own) expect(await publicAddresses(own.address)).toBeUndefined();
  });

  it("is a public address, given back to connect to", async () => {
    expect(await publicAddresses("93.184.215.14")).toEqual([
      { address: "93.184.215.14", family: 4 },
    ]);
  });
});

describe("the bytes waiting unsent", () => {
  it("are pending attachments and copies still being written, never a sent one's", async () => {
    const attachmentsDir = freshDir();
    const made = pendingFile(attachmentsDir, "clip.mp4");
    if (made === null) throw new Error("No place for clip.mp4");
    NodeFS.writeFileSync(made.path, "12345");
    NodeFS.writeFileSync(`${made.path}.00000000-0000-4000-8000-000000000009.part`, "123");
    NodeFS.writeFileSync(
      NodePath.join(attachmentsDir, "thread-1-00000000-0000-4000-8000-000000000004.png"),
      "sent, not waiting",
    );
    expect(await pendingBytes(attachmentsDir)).toBe(8);
  });
});
