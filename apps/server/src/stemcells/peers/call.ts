import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";

import { PEER_BODY_MOST, PEERS_PATH } from "./link.ts";

// One server calling a linked one's peer route, with the token that one
// minted for it. The address is the person's (Settings › Linked machines), so the call
// follows no redirect, the bearer token goes nowhere else, and the answer is
// read no further than a peer route ever sends.

export class PeerUnreachable extends Schema.TaggedError<PeerUnreachable>()("PeerUnreachable", {
  reason: Schema.String,
}) {}

export interface Answer {
  readonly status: number;
  /** The answer's JSON; null when it sent none. */
  readonly body: unknown;
}

export type Call = (
  baseUrl: string,
  token: string,
  route: "hello" | "roster" | "deliver" | "goodbye",
  body: unknown,
) => Effect.Effect<Answer, PeerUnreachable>;

const CALL_TIME = "10 seconds";
const NO_REDIRECT: RequestInit = { redirect: "error" };

const tooLarge = new PeerUnreachable({ reason: "it answered with more than a peer route sends" });

// Untraced: it reads each answer inside the call's span.
const textOf = Effect.fnUntraced(function* <E>(stream: Stream.Stream<Uint8Array, E>) {
  const chunks: Array<Uint8Array> = [];
  let size = 0;
  yield* Stream.runForEach(stream, (chunk) => {
    size += chunk.byteLength;
    if (size > PEER_BODY_MOST) return Effect.fail(tooLarge);
    chunks.push(chunk);
    return Effect.void;
  });
  return Buffer.concat(chunks).toString("utf8");
});

const decodeJson = Schema.decodeOption(Schema.fromJsonString(Schema.Unknown));
const jsonOf = (text: string): unknown => Option.getOrNull(decodeJson(text));

export const makeCall = Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient;
  const call: Call = (baseUrl, token, route, body) =>
    client
      .execute(
        HttpClientRequest.post(`${baseUrl}${PEERS_PATH}/peer/${route}`).pipe(
          HttpClientRequest.bearerToken(token),
          HttpClientRequest.bodyJsonUnsafe(body),
        ),
      )
      .pipe(
        Effect.flatMap((response) =>
          textOf(response.stream).pipe(
            Effect.map((text) => ({ status: response.status, body: jsonOf(text) })),
          ),
        ),
        Effect.catchTags({
          HttpClientError: () =>
            Effect.fail(new PeerUnreachable({ reason: "it couldn't be reached" })),
        }),
        Effect.provideService(FetchHttpClient.RequestInit, NO_REDIRECT),
        Effect.timeoutOrElse({
          duration: CALL_TIME,
          orElse: () => Effect.fail(new PeerUnreachable({ reason: "it didn't answer in time" })),
        }),
        Effect.withSpan("StemcellsPeers.call", { attributes: { route } }),
      );
  return call;
});
