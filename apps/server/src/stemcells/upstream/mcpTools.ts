/**
 * Our MCP tools, registered the way upstream registers its own toolkits:
 * `McpHttpServer.ts` adds them in one line.
 */
import * as Layer from "effect/Layer";

import type { toolkitRegistration } from "../../mcp/McpHttpServer.ts";
import * as Needs from "../needs/Needs.ts";
import { registerArcsTool } from "./arcsTool.ts";
import { registerDiskTool } from "./diskTool.ts";
import { registerPeerTool } from "./peerTool.ts";
import { registerStandingTool } from "./standingTool.ts";

export const registerStemcellsTools = (register: typeof toolkitRegistration) =>
  Layer.mergeAll(
    registerPeerTool(register),
    registerDiskTool(register),
    registerStandingTool(register).pipe(Layer.provide(Needs.layer)),
    registerArcsTool(register),
  );
