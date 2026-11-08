import type * as McpInvocationContext from "../../mcp/McpInvocationContext.ts";

/**
 * Stemcells has no hosted app, so an outside MCP client's thread links are the `t3-thread://`
 * links Stemcells' own clients read, which paste back as a Cell's chip, never upstream's through
 * T3's (`app.t3.codes`). `McpOAuth.ts` hands each client it authenticates through this.
 */
export function withoutHostedApp(
  client: McpInvocationContext.McpClientCaller,
): McpInvocationContext.McpClientCaller {
  const { hostedAppUrl: _hostedAppUrl, ...rest } = client;
  return rest;
}
