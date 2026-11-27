/**
 * Our MCP tools, registered the way upstream registers its own toolkits:
 * `McpHttpServer.ts` adds them in one line.
 */
import * as Layer from "effect/Layer";

import type { toolkitRegistration } from "../../mcp/McpHttpServer.ts";
import * as Needs from "../needs/Needs.ts";
import * as Recall from "../recall/Recall.ts";
import { registerArcsTool } from "./arcsTool.ts";
import { registerMoveTools } from "./diskMoveTool.ts";
import { registerDiskTool } from "./diskTool.ts";
import { registerPeerTool } from "./peerTool.ts";
import { registerRecallTool } from "./recallTool.ts";
import { registerSettingsTool } from "./settingsTool.ts";
import { registerShowTool } from "./showTool.ts";
import { registerStandingTool } from "./standingTool.ts";

export const registerStemcellsTools = (register: typeof toolkitRegistration) =>
  Layer.mergeAll(
    registerPeerTool(register),
    registerDiskTool(register),
    registerMoveTools(register),
    registerStandingTool(register).pipe(Layer.provide(Needs.layer)),
    registerRecallTool(register).pipe(Layer.provide(Recall.layer)),
    registerArcsTool(register),
    registerSettingsTool(register),
    registerShowTool(register),
  );
