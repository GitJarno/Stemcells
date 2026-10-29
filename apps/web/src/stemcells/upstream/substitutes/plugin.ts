// @effect-diagnostics nodeBuiltinImport:off - a build plugin: it maps files on disk.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import type { Plugin } from "vite-plus";

import { upstreamNamePlugin } from "../../../../../../stemcells/brand/nameTransform.ts";

/**
 * Upstream modules Stemcells replaces at build time with the same-named module in this folder,
 * so the upstream file importing one stays untouched: no seam. Our own folder still gets
 * upstream's, so a substitute can re-export what it replaces. Every web build reads this (dev,
 * the desktop's production build, both test projects); `substitutes.contract.test.ts` proves it.
 */
export const SUBSTITUTES: Readonly<Record<string, string>> = {
  // No favicon fetched: a link or a page shows the app's own mark.
  "packages/shared/src/favicon.ts": "favicon.ts",
  // Concise model names: the picker's update notice and a subagent's tooltip.
  "packages/client-runtime/src/providerUpdateRequiredModels.ts": "providerUpdateRequiredModels.ts",
  "packages/client-runtime/src/state/subagentDisplay.ts": "subagentDisplay.ts",
  // Concise model names: the naming helpers, and the subagent bar's own.
  "apps/web/src/components/chat/providerIconUtils.ts": "providerIconUtils.ts",
  "apps/web/src/components/chat/ProviderSubagentBar.tsx": "ProviderSubagentBar.tsx",
  "apps/web/src/components/chat/TimelineSystemDivider.tsx": "TimelineSystemDivider.tsx",
  // The auto-compact window: the context meter fills toward where it compacts.
  "apps/web/src/components/chat/ContextWindowMeter.tsx": "ContextWindowMeter.tsx",
  // The workbench: a pane's chat draws its panel and sheet at the tab's edge.
  "apps/web/src/components/RightPanelTabs.tsx": "RightPanelTabs.tsx",
  "apps/web/src/components/RightPanelSheet.tsx": "RightPanelSheet.tsx",
  // The workbench's width: capped against the tab's page, not the pane.
  "apps/web/src/hooks/usePreviewPanelInlineSize.ts": "usePreviewPanelInlineSize.ts",
  // The desktop browser rides its page through swipes and tab turns.
  "apps/web/src/browser/BrowserSurfaceSlot.tsx": "BrowserSurfaceSlot.tsx",
  // A desktop browser no one has wanted this run sleeps, with no webview.
  "apps/web/src/browser/HostedBrowserWebview.tsx": "HostedBrowserWebview.tsx",
  // A floating browser with no room beside the chat tucks to its edge.
  "apps/web/src/components/preview/ThreadPreviewMiniPlayer.tsx": "ThreadPreviewMiniPlayer.tsx",
  // Smart prompting: the composer inks the words that set a new chat up,
  // and sends the Cell its message without them.
  "apps/web/src/components/ComposerPromptEditorTiptap.tsx": "ComposerPromptEditorTiptap.tsx",
  "apps/web/src/components/chat/ChatComposer.tsx": "ChatComposer.tsx",
  // Settings never offers T3's privacy row, and our pages stand in its groups.
  "apps/web/src/components/settings/settingsSearch.ts": "settingsSearch.ts",
  // Where a Cell runs: upstream's branch toolbar in the menu under the
  // ledge's "branch ⌄", never under the box; git only once known.
  "apps/web/src/components/BranchToolbar.tsx": "BranchToolbar.tsx",
  // The sidebar's slot holds the left column: the Cells, the rail, or upstream's list.
  "apps/web/src/components/Sidebar.tsx": "Sidebar.tsx",
  // Aski stands over every new chat's headline, in a project or in none.
  "apps/web/src/components/chat/DraftHeroHeadline.tsx": "DraftHeroHeadline.tsx",
  // The hero names every place the words start Cells in.
  "apps/web/src/components/chat/DraftHeroProjectHeading.tsx": "DraftHeroProjectHeading.tsx",
  // The palette's chat in no project is a casual chat.
  "apps/web/src/components/CommandPalette.logic.ts": "CommandPalette.logic.ts",
  // Stemcells' mark: where upstream draws T3's wordmark as an icon.
  "apps/web/src/components/T3Wordmark.tsx": "T3Wordmark.tsx",
  // T3's GitHub app, which Stemcells never offers, keeps T3's icon out of the bundle.
  "apps/web/src/components/T3AppIcon.tsx": "T3AppIcon.tsx",
  // Updates built from the repository: the pill counts the changes, and a
  // nightly's notes link the day's merged pull requests, not a release.
  "apps/web/src/components/desktopUpdate.logic.ts": "desktopUpdate.logic.ts",
  "apps/web/src/components/sidebar/DesktopUpdateStatusIcon.tsx": "DesktopUpdateStatusIcon.tsx",
  // A new chat never starts on Aski's provider instance, nor in its no-project.
  "apps/web/src/lib/chatThreadActions.ts": "chatThreadActions.ts",
  // The welcome lists Claude Code among the agents, never Aski's instance.
  "apps/web/src/onboarding/providerReadiness.logic.ts": "providerReadiness.logic.ts",
  // T3's own tools in the work log say Cell, not thread.
  "packages/shared/src/t3McpToolPresentation.ts": "t3McpToolPresentation.ts",
  "packages/client-runtime/src/t3ToolSummary.ts": "t3ToolSummary.ts",
  "apps/web/src/components/chat/MessagesTimeline.logic.ts": "MessagesTimeline.logic.ts",
  // Messages between Cells: another Cell's message is a card, not the
  // person's bubble, and the app's collision notice a notice.
  "apps/web/src/components/chat/TimelineUserMessageRow.tsx": "TimelineUserMessageRow.tsx",
  // A turn the full disk stopped says so, with Free space, not "Provider error".
  "apps/web/src/components/chat/TimelineWorkEntryRow.tsx": "TimelineWorkEntryRow.tsx",
  // A Cell stopped by a usage limit: Continue on its banner, and the row
  // "Continued after …" where it carried on (the timeline's logic above).
  "apps/web/src/components/chat/UsageLimitRecoveryBanner.tsx": "UsageLimitRecoveryBanner.tsx",
  // Several Cells' readout stands in the composer's model picker's place.
  "apps/web/src/components/chat/ProviderModelPicker.tsx": "ProviderModelPicker.tsx",
  // The terminal drawer opens at about ten rows, its buttons in a row of their own.
  "apps/web/src/components/ThreadTerminalDrawer.tsx": "ThreadTerminalDrawer.tsx",
  // The stash sits on the Cell's line, on the row with its name.
  "apps/web/src/components/chat/ComposerStashBadge.tsx": "ComposerStashBadge.tsx",
  // Upstream's live rows ride the pane's one wave of light.
  "apps/web/src/lib/visibleAnimation.ts": "visibleAnimation.ts",
  // Stemcells' theme is built in, so the app wears it from its first frame.
  "packages/shared/src/themePalettes.ts": "themePalettes.ts",
  // Each provider's colour on the usage page is its own.
  "apps/web/src/components/usage/usageProviders.ts": "usageProviders.ts",
  // The usage page lists every plan a row each, as the rail's hover does.
  "apps/web/src/components/usage/UsageLimitsPooled.tsx": "UsageLimitsPooled.tsx",
  // ChatView safe to render twice: a chat's window shortcuts, its open-in
  // shortcut and paste-to-focus act only in the chat that owns the window's
  // input (the stash shortcut stands down through `../windowInput.tsx`).
  "apps/web/src/components/chat/useChatShortcuts.ts": "useChatShortcuts.ts",
  "apps/web/src/components/chat/OpenInPicker.tsx": "OpenInPicker.tsx",
  "apps/web/src/components/chat/usePasteToFocusComposer.ts": "usePasteToFocusComposer.ts",
  // Windows: one window notifies of a chat's turns, the focused one or else the lead.
  "apps/web/src/components/ThreadNotificationCoordinator.tsx": "ThreadNotificationCoordinator.tsx",
  // A thread chip opens its chat in a new pane beside the one it is in.
  "apps/web/src/components/ThreadContextChip.tsx": "ThreadContextChip.tsx",
  // A setting Aski links in a reply draws as its live switch.
  "apps/web/src/components/ChatMarkdown.tsx": "ChatMarkdown.tsx",
  // The work verbs: the timeline hands its rows the chat's verbs in our
  // context, read off the entries it draws.
  "apps/web/src/components/chat/MessagesTimeline.tsx": "MessagesTimeline.tsx",
  // A settle the person sends marks itself, so its pane closes and an
  // auto-settle's never does.
  "apps/web/src/hooks/useThreadActions.ts": "useThreadActions.ts",
  // Attachments carried between chats: a chat takes a carry as it takes
  // files off the disk, and a transcript's pictures and videos are carried
  // by dragging them (`payloads/`).
  "apps/web/src/components/chat/workspaceFileDrop.ts": "workspaceFileDrop.ts",
  "apps/web/src/components/media/MediaActions.tsx": "MediaActions.tsx",
};

/**
 * Upstream modules Stemcells replaces only for the upstream files in one
 * folder (`within`, from the repository's root): a module many views share,
 * changed where one of them draws it. Each is proven like the rest, and also
 * that a view outside the folder still gets upstream's module.
 */
export const SCOPED_SUBSTITUTES: Readonly<
  Record<string, { readonly within: string; readonly file: string }>
> = {
  // The usage page draws each provider as its Cell, in the provider's colour.
  "apps/web/src/components/chat/ProviderInstanceIcon.tsx": {
    within: "apps/web/src/components/usage/",
    file: "ProviderInstanceIcon.tsx",
  },
};

/**
 * Upstream's public files Stemcells serves its own in place of, by request path, each with our
 * file from the repository's root: the web icons carrying T3's mark. Upstream's files in
 * `apps/web/public` stay; dev answers these paths with ours and the production build overwrites
 * its copies. `brandMarks.contract.test.ts` holds this to upstream's icon list and build copies.
 */
export const PUBLIC_SUBSTITUTES: Readonly<Record<string, string>> = {
  "/favicon.ico": "stemcells/brand/web-favicon.ico",
  "/favicon-16x16.png": "stemcells/brand/web-favicon-16x16.png",
  "/favicon-32x32.png": "stemcells/brand/web-favicon-32x32.png",
  "/apple-touch-icon.png": "stemcells/brand/web-apple-touch-180.png",
};

const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const repoRoot = NodePath.resolve(here, "../../../../../..");
const ourRoot = NodePath.resolve(here, "../..");

const substituteOf: ReadonlyMap<string, string> = new Map(
  Object.entries(SUBSTITUTES).map(([upstream, ours]) => [
    NodePath.join(repoRoot, upstream),
    NodePath.join(here, ours),
  ]),
);

const scopedSubstituteOf: ReadonlyMap<string, { within: string; file: string }> = new Map(
  Object.entries(SCOPED_SUBSTITUTES).map(([upstream, { within, file }]) => [
    NodePath.join(repoRoot, upstream),
    { within: NodePath.resolve(repoRoot, within) + NodePath.sep, file: NodePath.join(here, file) },
  ]),
);

const isOurs = (id: string) => id.startsWith(ourRoot + NodePath.sep);

const publicSubstituteOf: ReadonlyMap<string, string> = new Map(
  Object.entries(PUBLIC_SUBSTITUTES).map(([path, ours]) => [path, NodePath.join(repoRoot, ours)]),
);

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".ico": "image/x-icon",
  ".png": "image/png",
};

/**
 * Resolves upstream's imports of a substituted module to ours, and serves and builds our public
 * files in place of upstream's. In dev and production builds, not tests, it also says Stemcells
 * where upstream's code says T3 Code (`stemcells/brand/nameTransform.ts`): tests run upstream's
 * code as upstream wrote it.
 */
export function substituteUpstreamModules(): Plugin {
  const naming = process.env.VITEST ? null : upstreamNamePlugin({ root: repoRoot });
  return {
    name: "stemcells:substitute-upstream-modules",
    enforce: "pre",
    ...(naming === null
      ? {}
      : {
          transform: naming.transform,
          transformIndexHtml: naming.transformIndexHtml,
          generateBundle: naming.generateBundle,
        }),
    async resolveId(source, importer, options) {
      if (importer === undefined || isOurs(importer)) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (resolved === null || resolved.external) return resolved;
      const scoped = scopedSubstituteOf.get(resolved.id);
      if (scoped !== undefined && importer.startsWith(scoped.within)) return scoped.file;
      return substituteOf.get(resolved.id) ?? resolved;
    },
    configureServer(server) {
      // Added here, ahead of Vite's own middleware, which serves `public/`.
      server.middlewares.use((request, response, next) => {
        const ours = publicSubstituteOf.get((request.url ?? "").split("?")[0]!);
        if (ours === undefined) return next();
        response.setHeader("Content-Type", CONTENT_TYPES[NodePath.extname(ours)] ?? "");
        response.setHeader("Cache-Control", "no-cache");
        response.end(NodeFS.readFileSync(ours));
      });
    },
    writeBundle(options) {
      // The build has copied `public/` into the output by now.
      if (options.dir === undefined) return;
      for (const [path, ours] of publicSubstituteOf) {
        const copied = NodePath.join(options.dir, path);
        if (NodeFS.existsSync(copied)) NodeFS.copyFileSync(ours, copied);
      }
    },
  };
}
