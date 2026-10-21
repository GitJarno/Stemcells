// @effect-diagnostics nodeBuiltinImport:off - Node's own server, which reads bodies as the app's does.
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as NodeHttp from "node:http";
import type * as NodeNet from "node:net";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { HttpServerRequest, HttpServerResponse } from "effect/http";

import { boundedText } from "./body.ts";

// A body past its bound, on the Node server the app runs: never read whole,
// whether it says how long it is or says nothing.

const MOST = 64 * 1024;
const CHUNK = Buffer.alloc(64 * 1024);
/** Far more than the bound and any socket's buffers: sent whole only if the server took it all. */
const FLOOD = 64 * 1024 * 1024;

const route = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const text = yield* boundedText(request, MOST);
  return Option.isNone(text)
    ? HttpServerResponse.empty({ status: 413 })
    : HttpServerResponse.text(String(text.value.length));
});

/**
 * Posts up to `total` bytes, declaring `length` or nothing, until the server
 * answers or hangs up: its status (none when it hung up) and what was sent.
 */
const post = (port: number, total: number, length?: number) =>
  new Promise<{ readonly status: number | null; readonly sent: number }>((resolve) => {
    const request = NodeHttp.request({
      host: "127.0.0.1",
      port,
      method: "POST",
      headers: length === undefined ? {} : { "content-length": String(length) },
    });
    let sent = 0;
    let done = false;
    const finish = (status: number | null) => {
      if (done) return;
      done = true;
      request.destroy();
      resolve({ status, sent });
    };
    request.on("response", (response) => {
      response.resume();
      finish(response.statusCode ?? null);
    });
    request.on("error", () => finish(null));
    // An answer or a hang-up arrives between writes, never during one.
    const pump = () => {
      if (done) return;
      while (sent < total) {
        sent += CHUNK.length;
        if (!request.write(CHUNK)) return void request.once("drain", pump);
      }
      request.end();
    };
    pump();
  });

it.live("reads a body no further than its bound, declared or not", () =>
  Effect.gen(function* () {
    const handler = yield* NodeHttpServer.makeHandler(route, { scope: yield* Effect.scope });
    const server = NodeHttp.createServer(handler);
    yield* Effect.addFinalizer(() =>
      Effect.promise(() => {
        server.closeAllConnections();
        return new Promise<void>((resolve) => server.close(() => resolve()));
      }),
    );
    yield* Effect.promise(() => new Promise<void>((done) => server.listen(0, "127.0.0.1", done)));
    const port = (server.address() as NodeNet.AddressInfo).port;

    return yield* Effect.promise(async () => {
      expect(await post(port, MOST, MOST)).toEqual({ status: 200, sent: MOST });
      // Declared too long: answered without waiting for it.
      const declared = await post(port, FLOOD, FLOOD);
      expect(declared.status).toBe(413);
      expect(declared.sent).toBeLessThan(FLOOD);
      // Declared nothing: the reader stops at the bound and hangs up.
      const undeclared = await post(port, FLOOD);
      expect(undeclared.status).not.toBe(200);
      expect(undeclared.sent).toBeLessThan(FLOOD);
    });
  }).pipe(Effect.scoped),
);
