import * as ByteSize from "effect/ByteSize";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import type { HttpServerRequest } from "effect/http";
import * as HttpIncomingMessage from "effect/http/HttpIncomingMessage";

// Our routes read a request's body only through here. The server reads any
// body whole unless `MaxBodySize` is set, and it is unset by default, so a
// signed-in caller could otherwise send gigabytes for it to hold.

/** The request's body as text, read no further than `most` bytes; none when it's larger or unreadable. */
export const boundedText = (request: HttpServerRequest.HttpServerRequest, most: number) => {
  const length = Number(request.headers["content-length"] ?? "0");
  if (!Number.isFinite(length) || length > most) return Effect.succeedNone;
  // Chunked requests carry no content-length, so the reader itself is capped,
  // and what it read is measured too.
  return request.text.pipe(
    Effect.provideService(HttpIncomingMessage.MaxBodySize, ByteSize.bytes(most)),
    Effect.option,
    Effect.map(Option.filter((text) => new TextEncoder().encode(text).byteLength <= most)),
  );
};
