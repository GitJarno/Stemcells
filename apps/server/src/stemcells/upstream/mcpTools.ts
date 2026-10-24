/**
 * Our MCP tools, registered the way upstream registers its own toolkits:
 * `McpHttpServer.ts` adds them in one line.
 */
import * as Layer from "effect/Layer";

import type { toolkitRegistration } from "../../mcp/McpHttpServer.ts";
import { registerDiskTool } from "./diskTool.ts";
import { registerPeerTool } from "./peerTool.ts";

export const registerStemcellsTools = (register: typeof toolkitRegistration) =>
  Layer.mergeAll(registerPeerTool(register), registerDiskTool(register));
