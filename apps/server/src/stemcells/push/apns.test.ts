// @effect-diagnostics nodeBuiltinImport:off - A throwaway P-256 key to sign with and its public half to check what Apple would, and an HTTP/2 server standing in for Apple.
import * as NodeCrypto from "node:crypto";
import * as NodeHttp2 from "node:http2";
import type * as NodeNet from "node:net";

import * as Schema from "effect/Schema";
import { assert, it } from "vite-plus/test";

import { providerToken, readsAsKey, sendAlert } from "./apns.ts";

const pair = NodeCrypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const p8 = pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const key = { keyId: "KEY1234567", teamId: "TEAM123456", p8 };
const decodeJson = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown));
const part = (text: string) => decodeJson(Buffer.from(text, "base64url").toString());

it("signs a provider token Apple checks with the key's public half", () => {
  const token = providerToken(key, 1_700_000_000.7);
  const [header = "", claims = "", signature = ""] = token.split(".");
  assert.deepStrictEqual(part(header), { alg: "ES256", kid: "KEY1234567" });
  assert.deepStrictEqual(part(claims), { iss: "TEAM123456", iat: 1_700_000_000 });
  // ES256 in a JWT is the raw 64-byte r‖s, not DER: Apple refuses the other.
  assert.isTrue(
    NodeCrypto.verify(
      "sha256",
      Buffer.from(`${header}.${claims}`),
      { key: pair.publicKey, dsaEncoding: "ieee-p1363" },
      Buffer.from(signature, "base64url"),
    ),
  );
});

it("puts nothing but an Apple ID into the token's header", () => {
  assert.throws(() => providerToken({ ...key, keyId: 'KEY","x":"1' }, 0));
  assert.throws(() => providerToken({ ...key, teamId: "team123456" }, 0));
});

it("takes a .p8 key and nothing else", () => {
  assert.isTrue(readsAsKey(p8));
  assert.isFalse(readsAsKey("not a key"));
});

const alert = {
  title: "A Cell",
  body: "Has a question",
  threadId: "thread-1",
  data: { environmentId: "env-1", threadId: "thread-1", deepLink: "/threads/env-1/thread-1" },
};

/** An HTTP/2 server on this machine, answering each request with `answer`. */
async function apple(
  answer: (stream: NodeHttp2.ServerHttp2Stream, headers: NodeHttp2.IncomingHttpHeaders) => void,
) {
  const server = NodeHttp2.createServer();
  server.on("stream", (stream, headers) => {
    // A stream closed with an error code says so on this side too.
    stream.on("error", () => {});
    answer(stream, headers);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as NodeNet.AddressInfo;
  return {
    origin: `http://127.0.0.1:${port}`,
    [Symbol.asyncDispose]: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

const send = (origin: string, withinMs?: number) =>
  sendAlert(
    {
      environment: "production",
      token: "aa11",
      topic: "com.example.cells",
      providerToken: "signed",
      alert,
    },
    { origin, ...(withinMs === undefined ? {} : { withinMs }) },
  );

it("posts the alert as Apple asks and reads its answer", async () => {
  let asked: NodeHttp2.IncomingHttpHeaders = {};
  let payload = "";
  await using server = await apple((stream, headers) => {
    asked = headers;
    stream.setEncoding("utf8");
    stream.on("data", (chunk: string) => (payload += chunk));
    stream.on("end", () => {
      stream.respond({ ":status": 410 });
      stream.end('{"reason":"Unregistered"}');
    });
  });
  assert.deepStrictEqual(await send(server.origin), { status: 410, reason: "Unregistered" });
  assert.strictEqual(asked[":path"], "/3/device/aa11");
  assert.strictEqual(asked["authorization"], "bearer signed");
  assert.strictEqual(asked["apns-topic"], "com.example.cells");
  assert.strictEqual(asked["apns-push-type"], "alert");
  assert.deepStrictEqual(decodeJson(payload), {
    aps: {
      alert: { title: "A Cell", body: "Has a question" },
      sound: "default",
      "thread-id": "thread-1",
    },
    body: alert.data,
  });
});

it("settles when Apple never answers, and when it drops the stream", async () => {
  await using silent = await apple(() => {});
  assert.strictEqual((await send(silent.origin, 50)).status, 0);

  await using dropping = await apple((stream) =>
    stream.close(NodeHttp2.constants.NGHTTP2_REFUSED_STREAM),
  );
  assert.strictEqual((await send(dropping.origin)).status, 0);
});
