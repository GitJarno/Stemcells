// @effect-diagnostics nodeBuiltinImport:off - parses upstream's .env.example, outside any runtime.
import * as NodeUtil from "node:util";

import { isCloudSwitch } from "./switches.ts";

// A template's name, a placeholder domain and a vendor's address are in upstream's source
// whatever the build: only a key, a client id, a token, a dataset or T3's relay says whose.
const NAMES_NO_ONE = /(?:JWT_TEMPLATE|PASSKEY_RP_DOMAINS|OTLP_TRACES_URL)$/;

/**
 * What no built Stemcells may hold: T3's analytics address, a PostHog project key, and each
 * value upstream's `.env.example` gives a cloud switch, its commented lines too. Those are the
 * public identifiers of T3's own Clerk, relay and trace store, so a build that holds one was
 * built with T3 Connect or its tracing on, however the value got there.
 */
export function t3Identifiers(envExample: string): Array<readonly [what: string, held: RegExp]> {
  const literal = (text: string) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const offered = NodeUtil.parseEnv(envExample.replace(/^#\s*(?=[A-Z0-9_]+=)/gm, ""));
  return [
    ["T3's analytics address", /ingest\.t3\.codes/],
    ["a PostHog project key", /\bphc_[A-Za-z0-9]{20,}/],
    ...Object.entries(offered)
      .filter(([name]) => isCloudSwitch(name) && !NAMES_NO_ONE.test(name))
      .filter(([, value]) => value !== undefined && value.length >= 8)
      .map(([name, value]) => [`.env.example's ${name}`, literal(value!)] as const),
  ];
}

/** Which of `identifiers` a built file's text holds, by what each is. */
export const heldIdentifiers = (
  text: string,
  identifiers: ReadonlyArray<readonly [what: string, held: RegExp]>,
): string[] => identifiers.filter(([, held]) => held.test(text)).map(([what]) => what);
