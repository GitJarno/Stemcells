// @effect-diagnostics nodeBuiltinImport:off - the timeout is set on Node's own HTTP server.
/**
 * What an upload of up to 1 GB relies on in upstream: its schemas take a file up to the upload
 * cap and not a byte more, the server advertises that cap, and the server's HTTP server leaves
 * an hour for a request where Node leaves five minutes (`stemcells/seams/packages.md`).
 */
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as NodeHttp from "node:http";
import {
  AttachmentCreateUploadUrlInput,
  ChatAttachment,
  FILE_ATTACHMENT_MAX_UPLOAD_BYTES,
} from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import * as ServerSecretStore from "../../auth/ServerSecretStore.ts";
import * as ServerConfig from "../../config.ts";
import * as ServerEnvironment from "../../environment/ServerEnvironment.ts";
import { rejectRequestsUntilServing } from "../../httpResponseErrorGuard.ts";

const video = (sizeBytes: number) => ({
  type: "file",
  name: "clip.mov",
  mimeType: "video/quicktime",
  sizeBytes,
});

describe("an upload of up to 1 GB", () => {
  it("is a valid upload and a valid attachment, and a byte more is neither", () => {
    const uploads = Schema.is(AttachmentCreateUploadUrlInput);
    const attachments = Schema.is(ChatAttachment);
    const id = "thread-1-00000000-0000-4000-8000-000000000003-mov";
    expect(FILE_ATTACHMENT_MAX_UPLOAD_BYTES).toBe(1024 * 1024 * 1024);
    expect(uploads(video(FILE_ATTACHMENT_MAX_UPLOAD_BYTES))).toBe(true);
    expect(uploads(video(FILE_ATTACHMENT_MAX_UPLOAD_BYTES + 1))).toBe(false);
    expect(attachments({ ...video(FILE_ATTACHMENT_MAX_UPLOAD_BYTES), id })).toBe(true);
    expect(attachments({ ...video(FILE_ATTACHMENT_MAX_UPLOAD_BYTES + 1), id })).toBe(false);
  });

  it("has an hour on the server's HTTP server, not Node's five minutes", () => {
    const server = rejectRequestsUntilServing(NodeHttp.createServer());
    expect(server.requestTimeout).toBe(60 * 60_000);
  });
});

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer))("the server", (it) => {
  it.effect("advertises the upload cap to every client", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const baseDir = yield* fileSystem.makeTempDirectoryScoped({ prefix: "stemcells-uploads-" });
      const descriptor = yield* Effect.gen(function* () {
        const environment = yield* ServerEnvironment.ServerEnvironment;
        return yield* environment.getDescriptor;
      }).pipe(
        Effect.provide(
          ServerEnvironment.layer.pipe(
            Layer.provide(ServerSecretStore.layer),
            Layer.provide(ServerConfig.layerTest(process.cwd(), baseDir)),
          ),
        ),
      );
      expect(descriptor.capabilities.fileAttachments).toEqual({
        maxUploadBytes: FILE_ATTACHMENT_MAX_UPLOAD_BYTES,
      });
    }),
  );
});
