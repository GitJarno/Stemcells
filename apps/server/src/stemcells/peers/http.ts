import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

import { boundedText } from "../http/body.ts";
import * as UpstreamDisk from "../upstream/disk.ts";
import * as Wire from "./link.ts";
import * as Links from "./Links.ts";

// The person's routes, on their own session: GET /links (Settings › Linked machines),
// POST /invite, /link and /unlink (who may reach this environment, so
// upstream's access:write, as pairing a device asks).
// A linked environment's routes, on the token this one minted for it, and
// nothing else: POST /peer/hello, /peer/roster, /peer/deliver, /peer/goodbye.

const NO_STORE = { "cache-control": "private, no-store" };

const json = (body: unknown, status = 200) =>
  HttpServerResponse.jsonUnsafe(body, { status, headers: NO_STORE });

const decodeJson = Schema.decodeOption(Schema.fromJsonString(Schema.Unknown));

/** The request's JSON, read no further than a peer route takes; none when larger or not JSON. */
const bodyOf = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const text = yield* boundedText(request, Wire.PEER_BODY_MOST);
  return Option.flatMap(text, decodeJson);
});

const personRoute = Effect.fn("StemcellsPeers.personRoute")(function* <A>(
  schema: Schema.Codec<A, unknown>,
  handle: (input: A) => Effect.Effect<unknown, Links.PeerRefusal>,
) {
  const body = yield* bodyOf;
  const input = Option.flatMap(body, Schema.decodeUnknownOption(schema));
  if (Option.isNone(input)) return json({ error: "That request isn't one this route takes." }, 400);
  return yield* handle(input.value).pipe(
    Effect.map((result) => json(result ?? {})),
    Effect.catchTags({
      PeerRefusal: (refusal) => Effect.succeed(json({ error: refusal.reason }, refusal.status)),
    }),
  );
});

const peerRoute = Effect.fn("StemcellsPeers.peerRoute")(function* (
  peers: Links.StemcellsPeers["Service"],
  route: string,
) {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const body = yield* bodyOf;
  if (Option.isNone(body)) return json({ error: "That request is too large or isn't JSON." }, 400);
  const answered = yield* peers.answer(route, request.headers.authorization, body.value);
  return json(answered.body, answered.status);
});

export const layer = HttpRouter.use((router) =>
  Effect.gen(function* () {
    const peers = yield* Links.StemcellsPeers;
    yield* router.add(
      "GET",
      `${Wire.PEERS_PATH}/links`,
      UpstreamDisk.withReadAccess(
        Effect.map(peers.links, (links) => json({ environmentId: peers.environmentId, links })),
      ),
    );
    yield* router.add(
      "POST",
      `${Wire.PEERS_PATH}/invite`,
      UpstreamDisk.withAccessWrite(personRoute(Wire.Invite, peers.invite)),
    );
    yield* router.add(
      "POST",
      `${Wire.PEERS_PATH}/link`,
      UpstreamDisk.withAccessWrite(personRoute(Wire.Link, peers.link)),
    );
    yield* router.add(
      "POST",
      `${Wire.PEERS_PATH}/unlink`,
      UpstreamDisk.withAccessWrite(
        personRoute(Wire.Unlink, ({ environmentId }) => peers.unlink(environmentId)),
      ),
    );
    for (const route of ["hello", "roster", "deliver", "goodbye"])
      yield* router.add("POST", `${Wire.PEERS_PATH}/peer/${route}`, peerRoute(peers, route));
  }),
).pipe(Layer.provide(Links.layer));
