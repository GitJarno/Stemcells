// @effect-diagnostics nodeBuiltinImport:off globalTimers:off - APNs speaks only HTTP/2, which the server's fetch is held from (outboundHttp.ts), so the exchange is node:http2's callbacks with a timer of their own; and Effect's Crypto has no ES256 signer.
/**
 * Apple's push service, spoken to straight from this Mac with the person's
 * own APNs key (stemcells/tasks/phone-push.md): no relay, no one else's
 * cloud. Upstream's relay (`infra/relay/src/agentActivity/ApnsClient.ts`)
 * sends the same request; this is its smallest form.
 */
import * as NodeCrypto from "node:crypto";
import * as NodeHttp2 from "node:http2";

import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

/** The person's APNs auth key: its Key ID, their Team ID, and the `.p8` file's text. */
export interface ApnsKey {
  readonly keyId: string;
  readonly teamId: string;
  readonly p8: string;
}

/** Which of Apple's two services a device's token belongs to: a development build's, or a release's. */
export type ApsEnvironment = "development" | "production";

/** Key and Team IDs are ten letters and digits; nothing else goes into a token's header. */
export const APPLE_ID = /^[A-Z0-9]{10}$/;

const ORIGINS: Readonly<Record<ApsEnvironment, string>> = {
  development: "https://api.sandbox.push.apple.com",
  production: "https://api.push.apple.com",
};

/** Whether `p8` is a private key node can sign with. */
export function readsAsKey(p8: string): boolean {
  try {
    return NodeCrypto.createPrivateKey(p8).asymmetricKeyType === "ec";
  } catch {
    return false;
  }
}

/**
 * The provider token APNs takes in place of a certificate: ES256 over the
 * key's id and the team's, issued at `issuedAt` (seconds). Apple refuses
 * one older than an hour and one renewed more than every 20 minutes.
 */
export function providerToken(key: ApnsKey, issuedAt: number): string {
  if (!APPLE_ID.test(key.keyId) || !APPLE_ID.test(key.teamId)) {
    throw new Error("An APNs Key ID and Team ID are ten letters and digits.");
  }
  const header = Buffer.from(`{"alg":"ES256","kid":"${key.keyId}"}`).toString("base64url");
  const claims = Buffer.from(`{"iss":"${key.teamId}","iat":${Math.floor(issuedAt)}}`).toString(
    "base64url",
  );
  const signature = NodeCrypto.sign("sha256", Buffer.from(`${header}.${claims}`), {
    key: key.p8,
    dsaEncoding: "ieee-p1363",
  });
  return `${header}.${claims}.${signature.toString("base64url")}`;
}

export interface Alert {
  readonly title: string;
  readonly body: string;
  /** Groups a Cell's pushes on the phone. */
  readonly threadId: string;
  /** What the phone opens on a tap, as upstream's app reads it (`notificationPayload.ts`). */
  readonly data: {
    readonly environmentId: string;
    readonly threadId: string;
    readonly deepLink: string;
  };
}

const encodePayload = Schema.encodeSync(
  Schema.fromJsonString(
    Schema.Struct({
      aps: Schema.Struct({
        alert: Schema.Struct({ title: Schema.String, body: Schema.String }),
        sound: Schema.String,
        "thread-id": Schema.String,
      }),
      body: Schema.Struct({
        environmentId: Schema.String,
        threadId: Schema.String,
        deepLink: Schema.String,
      }),
    }),
  ),
);
const decodeReason = Schema.decodeUnknownOption(
  Schema.fromJsonString(Schema.Struct({ reason: Schema.optional(Schema.String) })),
);

/** What Apple said: its status (0 when it was never reached) and its reason, when it gave one. */
export interface Sent {
  readonly status: number;
  readonly reason: string | null;
}

const WITHIN_MS = 15_000;

/**
 * Sends one alert to one device; never throws, and settles within
 * `withinMs` whatever Apple or the network does. Tests point `origin`
 * at a server of their own.
 */
export function sendAlert(
  input: {
    readonly environment: ApsEnvironment;
    readonly token: string;
    /** The app's bundle id, which the key's team must own. */
    readonly topic: string;
    readonly providerToken: string;
    readonly alert: Alert;
  },
  options: { readonly origin?: string; readonly withinMs?: number } = {},
): Promise<Sent> {
  const payload = encodePayload({
    aps: {
      alert: { title: input.alert.title, body: input.alert.body },
      sound: "default",
      "thread-id": input.alert.threadId,
    },
    // Expo hands the app `body` as the notification's data.
    body: input.alert.data,
  });
  const withinMs = options.withinMs ?? WITHIN_MS;
  return new Promise((resolve) => {
    let settled = false;
    let status = 0;
    let body = "";
    const session = NodeHttp2.connect(options.origin ?? ORIGINS[input.environment]);
    const done = (sent: Sent) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      session.destroy();
      resolve(sent);
    };
    // One timer for the whole exchange: a connection that never opens, a
    // stream that never answers, and one Apple closes without a word.
    const timer = setTimeout(
      () => done({ status: 0, reason: `Apple didn't answer in ${withinMs / 1000} s` }),
      withinMs,
    );
    session.on("error", (error) => done({ status: 0, reason: error.message }));
    const request = session.request({
      ":method": "POST",
      ":path": `/3/device/${encodeURIComponent(input.token)}`,
      authorization: `bearer ${input.providerToken}`,
      "apns-topic": input.topic,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });
    request.setEncoding("utf8");
    request.on("response", (headers) => {
      status = Number(headers[":status"] ?? 0);
    });
    request.on("data", (chunk: string) => {
      body += chunk;
    });
    request.on("end", () => {
      const read = decodeReason(body);
      done({ status, reason: Option.isSome(read) ? (read.value.reason ?? null) : null });
    });
    request.on("error", (error) => done({ status: 0, reason: error.message }));
    request.on("close", () =>
      done({ status, reason: status === 0 ? "Apple closed the stream" : null }),
    );
    request.end(payload);
  });
}

/** A send that may go through on a later try: Apple never reached, busy, or failing. */
export const isTransient = (sent: Sent) =>
  sent.status === 0 || sent.status === 429 || sent.status >= 500;

/** Apple's word that a token is gone for good: the phone's app was removed, or the token is wrong. */
export const isGone = (sent: Sent) =>
  sent.status === 410 || sent.reason === "BadDeviceToken" || sent.reason === "Unregistered";
