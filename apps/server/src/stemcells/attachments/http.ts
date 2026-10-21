import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

import { boundedText } from "../http/body.ts";
import * as Attachments from "../upstream/attachments.ts";
import * as UpstreamDisk from "../upstream/disk.ts";
import {
  cleanName,
  fromAddress,
  readPicture,
  store,
  type Incoming,
  type Picture,
  type Refusal,
  type Resolve,
  type Stored,
} from "./import.ts";

// POST /api/stemcells/attachments/import: a file one chat shows, brought
// into another chat's draft as an attachment of its own.
//
//   { from: { asset }, name? }       a file a chat shows, by the signed URL
//                                    it was shown by: copied into a pending
//                                    attachment, its id answered as JSON
//   { from: { url }, as?, name? }    a public web address, fetched once:
//                                    stored the same way, or, `as:
//                                    "picture"`, its bytes answered (a
//                                    picture's chip needs them in the page)
//
// A refusal answers 4xx or 5xx with `{ reason }`, a few words the chat
// shows. A few imports run at once, the bytes waiting unsent in the store
// have a ceiling, and an import stops, leaving nothing, when its caller
// goes away.

export const IMPORT_PATH = "/api/stemcells/attachments/import";
const NO_STORE = { "cache-control": "private, no-store" };
/** The largest import request read, in bytes: an address or a signed URL, and a name. */
export const IMPORT_BODY_MOST = 256_000;

export interface Limits {
  /** How many imports run at once. */
  readonly imports: number;
  /** How many bytes may wait unsent in the store, imports underway included. */
  readonly pendingBytes: number;
  /** Where web addresses may connect (tests let their own server through). */
  readonly resolve?: Resolve;
}

export const LIMITS: Limits = { imports: 3, pendingBytes: 1024 * 1024 * 1024 };

const ImportRequest = Schema.Struct({
  from: Schema.Union([
    Schema.Struct({ asset: Schema.String }),
    Schema.Struct({ url: Schema.String }),
  ]),
  as: Schema.optional(Schema.Literals(["file", "picture"])),
  name: Schema.optional(Schema.String),
});
const decodeImportRequest = Schema.decodeUnknownOption(Schema.fromJsonString(ImportRequest));

const refuse = (status: Refusal["status"], reason: string): Refusal => ({
  ok: false,
  status,
  reason,
});

const answer = (result: Stored | Picture | Refusal, name?: string) => {
  if (!result.ok)
    return HttpServerResponse.jsonUnsafe(
      { reason: result.reason },
      { status: result.status, headers: NO_STORE },
    );
  if ("bytes" in result)
    return HttpServerResponse.uint8Array(result.bytes, {
      contentType: result.mimeType,
      headers: {
        ...NO_STORE,
        "x-content-type-options": "nosniff",
        "x-stemcells-name": encodeURIComponent(name ?? result.name),
      },
    });
  return HttpServerResponse.jsonUnsafe(result, { headers: NO_STORE });
};

/** The route, with its own count of imports underway and bytes held for them. */
export function makeLayer(limits: Limits = LIMITS) {
  let running = 0;
  let held = 0;

  /** A place among the imports running at once, for as long as the scope lasts. */
  const place = Effect.acquireRelease(
    Effect.sync(() => {
      if (running >= limits.imports) return false;
      running += 1;
      return true;
    }),
    (taken) =>
      Effect.sync(() => {
        if (taken) running -= 1;
      }),
  );

  /** Room for `bytes` more to wait in the store; a function giving it back, or null when there is none. */
  const room = async (attachmentsDir: string, bytes: number) => {
    held += bytes;
    if ((await Attachments.pendingBytes(attachmentsDir)) + held > limits.pendingBytes) {
      held -= bytes;
      return null;
    }
    return () => {
      held -= bytes;
    };
  };

  /** Copies `incoming` into a pending attachment of its own, at most `cap` bytes. */
  const keep = async (
    attachmentsDir: string,
    incoming: Incoming,
    cap: number,
    signal: AbortSignal,
  ): Promise<Stored | Refusal> => {
    const target = Attachments.pendingFile(attachmentsDir, incoming.name);
    if (target === null) {
      incoming.discard();
      return refuse(400, "No place to keep it");
    }
    const giveBack = await room(attachmentsDir, Math.min(incoming.size ?? cap, cap));
    if (giveBack === null) {
      incoming.discard();
      return refuse(507, "Too many files waiting to send");
    }
    try {
      return await store(incoming, target, cap, signal);
    } finally {
      giveBack();
    }
  };

  const importRoute = Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const body = yield* boundedText(request, IMPORT_BODY_MOST);
    if (Option.isNone(body)) return answer(refuse(413, "Too large to read"));
    const asked = decodeImportRequest(body.value);
    if (Option.isNone(asked)) return answer(refuse(400, "Not understood"));
    const { from, as = "file", name } = asked.value;
    if ("asset" in from && as === "picture") return answer(refuse(400, "Not understood"));
    const attachmentsDir = yield* Attachments.attachmentsDirectory;

    return yield* Effect.scoped(
      Effect.gen(function* () {
        if (!(yield* place)) return answer(refuse(503, "Busy, try again"));

        if ("asset" in from) {
          const result = yield* Attachments.withAssetFile(from.asset, (file, signal) =>
            keep(
              attachmentsDir,
              {
                name: cleanName(name) ?? file.name,
                mimeType: file.mimeType ?? "application/octet-stream",
                size: file.size,
                open: file.open,
                discard: () => {},
              },
              Attachments.MAX_FILE_BYTES,
              signal,
            ),
          );
          return answer(result ?? refuse(404, "No longer there"));
        }

        const cap = as === "picture" ? Attachments.MAX_PICTURE_BYTES : Attachments.MAX_FILE_BYTES;
        const kept = cleanName(name);
        const result = yield* Effect.promise(async (signal) => {
          const incoming = await fromAddress(from.url, cap, {
            signal,
            ...(limits.resolve ? { resolve: limits.resolve } : {}),
          });
          if ("ok" in incoming) return incoming;
          const named = kept === null ? incoming : { ...incoming, name: kept };
          return as === "picture"
            ? readPicture(named, cap, signal)
            : keep(attachmentsDir, named, cap, signal);
        });
        return answer(result, kept ?? undefined);
      }),
    );
  });

  return HttpRouter.use((router) =>
    router.add("POST", IMPORT_PATH, UpstreamDisk.withOperateAccess(importRoute)),
  );
}

export const layer = makeLayer();
