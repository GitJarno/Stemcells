// Replaces `@t3tools/shared/favicon` (`plugin.ts`). No `export *`: a name
// upstream adds here may fetch an icon, so the contract test stops on it.
export { faviconUrlForOrigin, toolActivityFaviconUrl } from "../favicon";
