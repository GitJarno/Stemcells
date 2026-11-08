// @effect-diagnostics nodeBuiltinImport:off - reads McpOAuth's source.
/**
 * An outside MCP client's thread links are the `t3-thread://` links Stemcells' own clients read,
 * never one through T3's hosted app (`mcpClients.ts`). A failure after a sync names what moved:
 * upstream's link for a client with no hosted app, or `McpOAuth.ts` no longer handing the client
 * it authenticates through ours.
 */
import * as NodeFS from "node:fs";

import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import * as McpInvocationContext from "../../mcp/McpInvocationContext.ts";
import { withoutHostedApp } from "./mcpClients.ts";

describe("an outside MCP client's thread links", () => {
  it("are the Cell's own link, never one through T3's hosted app", () => {
    const client = withoutHostedApp({
      sessionId: "session-1",
      label: "Outside agent",
      access: "read-only",
      linked: false,
      hostedAppUrl: "https://app.t3.codes",
    });
    expect(client).toEqual({
      sessionId: "session-1",
      label: "Outside agent",
      access: "read-only",
      linked: false,
    });
    const link = McpInvocationContext.threadLinkFor(
      { environmentId: EnvironmentId.make("env-1"), client },
      ThreadId.make("thread-1"),
    );
    expect(link).toBe("<t3-thread://v2/env-1/thread-1>");
  });

  it("McpOAuth.ts hands every client it authenticates through ours", () => {
    const source = NodeFS.readFileSync(new URL("../../auth/McpOAuth.ts", import.meta.url), "utf8");
    expect(source.split("\n")[0]).toBe(
      'import * as Stemcells from "../stemcells/upstream/mcpClients.ts";',
    );
    expect(source).toMatch(
      /client: Stemcells\.withoutHostedApp\(\{[^}]*\.\.\.\(client\.peerLink \? \{\} : \{ hostedAppUrl \}\),\s*\}\),/,
    );
  });
});
