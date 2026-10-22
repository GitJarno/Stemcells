// @effect-diagnostics nodeBuiltinImport:off - reads upstream's files and builds the app.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import * as UpstreamUpdateNotice from "@t3tools/client-runtime/providerUpdateRequiredModels";
import * as UpstreamSubagentDisplay from "@t3tools/client-runtime/state/subagent-display";
import * as UpstreamT3ToolSummary from "@t3tools/client-runtime/t3ToolSummary";
import * as UpstreamFavicon from "@t3tools/shared/favicon";
import * as UpstreamT3McpTools from "@t3tools/shared/t3McpToolPresentation";
import * as UpstreamThemePalettes from "@t3tools/shared/themePalettes";
import { build, createServer, type ConfigEnv, type Plugin, type UserConfig } from "vite-plus";
import { describe, expect, it } from "vite-plus/test";

import webConfig from "../../../../vite.config";
import * as UpstreamBrowserSurfaceSlot from "../../../browser/BrowserSurfaceSlot";
import * as UpstreamBranchToolbar from "../../../components/BranchToolbar";
import * as UpstreamHostedBrowserWebview from "../../../browser/HostedBrowserWebview";
import * as UpstreamComposerPromptEditor from "../../../components/ComposerPromptEditor";
import * as UpstreamChatComposer from "../../../components/chat/ChatComposer";
import * as UpstreamComposerStashBadge from "../../../components/chat/ComposerStashBadge";
import * as UpstreamRightPanelSheet from "../../../components/RightPanelSheet";
import * as UpstreamRightPanelTabs from "../../../components/RightPanelTabs";
import * as UpstreamT3Wordmark from "../../../components/T3Wordmark";
import * as UpstreamThreadNotificationCoordinator from "../../../components/ThreadNotificationCoordinator";
import * as UpstreamThreadTerminalDrawer from "../../../components/ThreadTerminalDrawer";
import * as UpstreamUsageProviders from "../../../components/usage/usageProviders";
import * as UpstreamContextWindowMeter from "../../../components/chat/ContextWindowMeter";
import * as UpstreamComposerScrollGesture from "../../../components/chat/composerScrollGesture";
import * as UpstreamSettingsSearch from "../../../components/settings/settingsSearch";
import * as UpstreamDraftHeroProjectHeading from "../../../components/chat/DraftHeroProjectHeading";
import * as UpstreamTimelineLogic from "../../../components/chat/MessagesTimeline.logic";
import * as UpstreamProviderModelPicker from "../../../components/chat/ProviderModelPicker";
import * as UpstreamProviderSubagentBar from "../../../components/chat/ProviderSubagentBar";
import * as UpstreamTimelineSystemDivider from "../../../components/chat/TimelineSystemDivider";
import * as UpstreamUsageLimitRecoveryBanner from "../../../components/chat/UsageLimitRecoveryBanner";
import * as UpstreamProviderIconUtils from "../../../components/chat/providerIconUtils";
import * as UpstreamPanelInlineSize from "../../../hooks/usePreviewPanelInlineSize";
import * as UpstreamChatThreadActions from "../../../lib/chatThreadActions";
import * as UpstreamFaviconReexport from "../../../lib/favicon";
import * as UpstreamVisibleAnimation from "../../../lib/visibleAnimation";
import * as UpstreamUseChatShortcuts from "../../../components/chat/useChatShortcuts";
import * as UpstreamOpenInPicker from "../../../components/chat/OpenInPicker";
import * as OurBranchToolbar from "./BranchToolbar";
import * as OurBrowserSurfaceSlot from "./BrowserSurfaceSlot";
import * as OurHostedBrowserWebview from "./HostedBrowserWebview";
import * as OurChatComposer from "./ChatComposer";
import * as OurChatThreadActions from "./chatThreadActions";
import * as OurComposerPromptEditor from "./ComposerPromptEditor";
import * as OurComposerScrollGesture from "./composerScrollGesture";
import * as OurComposerStashBadge from "./ComposerStashBadge";
import * as OurContextWindowMeter from "./ContextWindowMeter";
import * as OurDraftHeroProjectHeading from "./DraftHeroProjectHeading";
import * as OurProviderModelPicker from "./ProviderModelPicker";
import * as OurFavicon from "./favicon";
import * as OurTimelineLogic from "./MessagesTimeline.logic";
import { SUBSTITUTES, substituteUpstreamModules } from "./plugin";
import * as OurProviderIconUtils from "./providerIconUtils";
import * as OurProviderSubagentBar from "./ProviderSubagentBar";
import * as OurUpdateNotice from "./providerUpdateRequiredModels";
import * as OurRightPanelSheet from "./RightPanelSheet";
import * as OurRightPanelTabs from "./RightPanelTabs";
import * as OurSettingsSearch from "./settingsSearch";
import * as OurSubagentDisplay from "./subagentDisplay";
import * as OurT3McpTools from "./t3McpToolPresentation";
import * as OurT3ToolSummary from "./t3ToolSummary";
import * as OurT3Wordmark from "./T3Wordmark";
import * as OurThemePalettes from "./themePalettes";
import * as OurThreadNotificationCoordinator from "./ThreadNotificationCoordinator";
import * as OurThreadTerminalDrawer from "./ThreadTerminalDrawer";
import * as OurTimelineSystemDivider from "./TimelineSystemDivider";
import * as OurUsageLimitRecoveryBanner from "./UsageLimitRecoveryBanner";
import * as OurPanelInlineSize from "./usePreviewPanelInlineSize";
import * as OurUsageProviders from "./usageProviders";
import * as OurVisibleAnimation from "./visibleAnimation";
import * as OurUseChatShortcuts from "./useChatShortcuts";
import * as OurOpenInPicker from "./OpenInPicker";

/**
 * Contract: every build of the web app hands upstream's code our substitute
 * for each module in `SUBSTITUTES`, and each substitute still exports what its
 * upstream module does. If this fails after a sync, upstream's views have
 * quietly gone back to upstream's module (favicons fetched, vendor words in
 * model names), or a substitute is missing a name upstream now exports.
 */

const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const repoRoot = NodePath.resolve(here, "../../../../../..");
const webRoot = NodePath.join(repoRoot, "apps/web");
const fromRepo = (file: string) => NodePath.join(repoRoot, file);

/**
 * The same names, each taking what upstream's does. For components that may
 * render nothing where upstream's always renders: JSX doesn't read a
 * component's return type, so null is safe there.
 */
type RendersOrNothing<Module> = {
  [Name in keyof Module]: Module[Name] extends (...args: infer Args) => unknown
    ? (...args: Args) => unknown
    : Module[Name];
};

interface Case {
  readonly upstream: object;
  readonly substitute: object;
  /**
   * Upstream files that import the module: the specifier each imports it by,
   * and the names it must keep taking from there.
   */
  readonly importers: Readonly<Record<string, readonly [string, ReadonlyArray<string>]>>;
  /** Why the server must keep upstream's module, when it imports it too. */
  readonly serverKeepsUpstream?: string;
}

const CASES: Readonly<Record<string, Case>> = {
  "packages/shared/src/favicon.ts": {
    upstream: UpstreamFavicon,
    substitute: OurFavicon satisfies typeof UpstreamFavicon,
    importers: {
      "apps/web/src/components/chat/MarkdownExternalLink.tsx": [
        "@t3tools/shared/favicon",
        ["faviconUrlForOrigin"],
      ],
      "apps/web/src/components/chat/TimelineToolActivityIcon.tsx": [
        "@t3tools/shared/favicon",
        ["toolActivityFaviconUrl"],
      ],
      "apps/web/src/lib/favicon.ts": ["@t3tools/shared/favicon", ["faviconUrlForOrigin"]],
    },
  },
  "packages/client-runtime/src/providerUpdateRequiredModels.ts": {
    upstream: UpstreamUpdateNotice,
    substitute: OurUpdateNotice satisfies typeof UpstreamUpdateNotice,
    importers: {
      "apps/web/src/components/chat/ModelPickerContent.tsx": [
        "@t3tools/client-runtime/providerUpdateRequiredModels",
        ["formatProviderUpdateRequiredNotice"],
      ],
    },
  },
  "packages/client-runtime/src/state/subagentDisplay.ts": {
    upstream: UpstreamSubagentDisplay,
    substitute: OurSubagentDisplay satisfies typeof UpstreamSubagentDisplay,
    importers: {
      "apps/web/src/components/chat/SubagentTooltipContent.tsx": [
        "@t3tools/client-runtime/state/subagent-display",
        ["resolveSubagentMetadata"],
      ],
      "apps/web/src/components/chat/V2LifecycleRow.tsx": [
        "@t3tools/client-runtime/state/subagent-display",
        ["formatSubagentDisplayTitle"],
      ],
    },
  },
  "apps/web/src/components/chat/providerIconUtils.ts": {
    upstream: UpstreamProviderIconUtils,
    substitute: OurProviderIconUtils satisfies typeof UpstreamProviderIconUtils,
    importers: {
      "apps/web/src/components/ChatView.tsx": [
        "./chat/providerIconUtils",
        ["getTriggerDisplayModelName"],
      ],
      "apps/web/src/components/sidebar/SidebarThreadRow.tsx": [
        "../chat/providerIconUtils",
        ["getTriggerDisplayModelLabel"],
      ],
      "apps/web/src/components/chat/ModelListRow.tsx": [
        "./providerIconUtils",
        ["getDisplayModelName", "getTriggerDisplayModelLabel"],
      ],
      "apps/web/src/components/chat/ProviderModelPicker.tsx": [
        "./providerIconUtils",
        ["getTriggerDisplayModelLabel", "getTriggerDisplayModelName"],
      ],
      "apps/web/src/components/chat/V2LifecycleRow.tsx": [
        "./providerIconUtils",
        ["getTriggerDisplayModelName"],
      ],
      "apps/web/src/components/chat/ContextWindowMeter.logic.ts": [
        "./providerIconUtils",
        ["getTriggerDisplayModelName"],
      ],
    },
  },
  "apps/web/src/components/chat/ProviderSubagentBar.tsx": {
    upstream: UpstreamProviderSubagentBar,
    substitute: OurProviderSubagentBar satisfies typeof UpstreamProviderSubagentBar,
    importers: {
      "apps/web/src/components/ChatView.tsx": [
        "./chat/ProviderSubagentBar",
        ["ProviderSubagentBar"],
      ],
    },
  },
  "apps/web/src/components/chat/TimelineSystemDivider.tsx": {
    upstream: UpstreamTimelineSystemDivider,
    substitute: OurTimelineSystemDivider satisfies typeof UpstreamTimelineSystemDivider,
    importers: {
      "apps/web/src/components/chat/MessagesTimeline.tsx": [
        "./TimelineSystemDivider",
        ["TimelineSystemDivider"],
      ],
    },
  },
  "apps/web/src/components/chat/ContextWindowMeter.tsx": {
    upstream: UpstreamContextWindowMeter,
    substitute: OurContextWindowMeter satisfies typeof UpstreamContextWindowMeter,
    importers: {
      "apps/web/src/components/chat/ComposerFooterControls.tsx": [
        "./ContextWindowMeter",
        ["ContextWindowMeter"],
      ],
    },
  },
  "apps/web/src/components/RightPanelTabs.tsx": {
    upstream: UpstreamRightPanelTabs,
    substitute: OurRightPanelTabs satisfies RendersOrNothing<typeof UpstreamRightPanelTabs>,
    importers: {
      "apps/web/src/components/chat/ChatRightPanel.tsx": ["../RightPanelTabs", ["RightPanelTabs"]],
    },
  },
  "apps/web/src/components/RightPanelSheet.tsx": {
    upstream: UpstreamRightPanelSheet,
    substitute: OurRightPanelSheet satisfies RendersOrNothing<typeof UpstreamRightPanelSheet>,
    importers: {
      "apps/web/src/components/chat/ChatRightPanel.tsx": [
        "../RightPanelSheet",
        ["RightPanelSheet"],
      ],
    },
  },
  "apps/web/src/components/ThreadNotificationCoordinator.tsx": {
    upstream: UpstreamThreadNotificationCoordinator,
    substitute: OurThreadNotificationCoordinator satisfies RendersOrNothing<
      typeof UpstreamThreadNotificationCoordinator
    >,
    importers: {
      "apps/web/src/routes/__root.tsx": [
        "../components/ThreadNotificationCoordinator",
        ["ThreadNotificationCoordinator"],
      ],
    },
  },
  "apps/web/src/hooks/usePreviewPanelInlineSize.ts": {
    upstream: UpstreamPanelInlineSize,
    substitute: OurPanelInlineSize satisfies typeof UpstreamPanelInlineSize,
    importers: {
      "apps/web/src/components/chat/ChatRightPanel.tsx": [
        "../../hooks/usePreviewPanelInlineSize",
        ["usePreviewPanelInlineSize"],
      ],
      "apps/web/src/components/preview/PreviewPanelShell.tsx": [
        "~/hooks/usePreviewPanelInlineSize",
        ["usePreviewPanelInlineSize"],
      ],
    },
  },
  "apps/web/src/browser/BrowserSurfaceSlot.tsx": {
    upstream: UpstreamBrowserSurfaceSlot,
    substitute: OurBrowserSurfaceSlot satisfies RendersOrNothing<typeof UpstreamBrowserSurfaceSlot>,
    importers: {
      "apps/web/src/components/preview/PreviewView.tsx": [
        "~/browser/BrowserSurfaceSlot",
        ["BrowserSurfaceSlot"],
      ],
      "apps/web/src/components/preview/ThreadPreviewMiniPlayer.tsx": [
        "~/browser/BrowserSurfaceSlot",
        ["BrowserSurfaceSlot"],
      ],
    },
  },
  "apps/web/src/browser/HostedBrowserWebview.tsx": {
    upstream: UpstreamHostedBrowserWebview,
    substitute: OurHostedBrowserWebview satisfies RendersOrNothing<
      typeof UpstreamHostedBrowserWebview
    >,
    importers: {
      "apps/web/src/browser/ElectronBrowserHost.tsx": [
        "./HostedBrowserWebview",
        ["HostedBrowserWebview"],
      ],
    },
  },
  "apps/web/src/components/ComposerPromptEditor.tsx": {
    upstream: UpstreamComposerPromptEditor,
    substitute: OurComposerPromptEditor satisfies RendersOrNothing<
      typeof UpstreamComposerPromptEditor
    >,
    importers: {
      "apps/web/src/components/chat/ChatComposer.tsx": [
        "../ComposerPromptEditor",
        ["ComposerPromptEditor"],
      ],
      "apps/web/src/components/settings/SettingsFontPreviews.tsx": [
        "../ComposerPromptEditor",
        ["ComposerPromptEditor"],
      ],
    },
  },
  "apps/web/src/components/chat/composerScrollGesture.ts": {
    upstream: UpstreamComposerScrollGesture,
    substitute: OurComposerScrollGesture satisfies typeof UpstreamComposerScrollGesture,
    importers: {
      "apps/web/src/components/chat/ChatComposer.tsx": [
        "./composerScrollGesture",
        ["recordComposerScrollGestureEvent", "shouldCollapseComposerForScrollKey"],
      ],
    },
  },
  "apps/web/src/components/BranchToolbar.tsx": {
    upstream: UpstreamBranchToolbar,
    substitute: OurBranchToolbar satisfies RendersOrNothing<typeof UpstreamBranchToolbar>,
    importers: {
      "apps/web/src/components/ChatView.tsx": ["./BranchToolbar", ["BranchToolbar"]],
      "apps/web/src/components/chat/ThreadDetailsPanel.tsx": [
        "../BranchToolbar",
        ["BranchToolbar"],
      ],
    },
  },
  "apps/web/src/components/settings/settingsSearch.ts": {
    upstream: UpstreamSettingsSearch,
    substitute: OurSettingsSearch satisfies typeof UpstreamSettingsSearch,
    importers: {
      "apps/web/src/components/CommandPalette.tsx": [
        "./settings/settingsSearch",
        ["searchSettings"],
      ],
      "apps/web/src/components/settings/SettingsSidebarNav.tsx": [
        "./settingsSearch",
        ["searchSettings"],
      ],
      // The list both searches above search in.
      "apps/web/src/components/settings/useAvailableSettingsSearchItems.ts": [
        "./settingsSearch",
        ["filterAvailableSettingsSearchItems"],
      ],
      // Its rows' anchors: the privacy row is hidden through its own.
      "apps/web/src/components/settings/SettingsPanels.tsx": [
        "./settingsSearch",
        ["searchableSetting"],
      ],
    },
  },
  "apps/web/src/components/chat/ChatComposer.tsx": {
    upstream: UpstreamChatComposer,
    substitute: OurChatComposer satisfies RendersOrNothing<typeof UpstreamChatComposer>,
    importers: {
      "apps/web/src/components/ChatView.tsx": ["./chat/ChatComposer", ["ChatComposer"]],
    },
  },
  "apps/web/src/components/chat/DraftHeroProjectHeading.tsx": {
    upstream: UpstreamDraftHeroProjectHeading,
    substitute: OurDraftHeroProjectHeading satisfies RendersOrNothing<
      typeof UpstreamDraftHeroProjectHeading
    >,
    importers: {
      "apps/web/src/components/chat/DraftHeroHeadline.tsx": [
        "./DraftHeroProjectHeading",
        ["DraftHeroProjectHeading"],
      ],
    },
  },
  "apps/web/src/components/T3Wordmark.tsx": {
    upstream: UpstreamT3Wordmark,
    substitute: OurT3Wordmark satisfies typeof UpstreamT3Wordmark,
    importers: {
      "apps/web/src/components/chat/TimelineToolActivityIcon.tsx": [
        "../T3Wordmark",
        ["T3Wordmark"],
      ],
      "apps/web/src/components/chat/V2LifecycleRow.tsx": ["../T3Wordmark", ["T3Wordmark"]],
    },
  },
  "apps/web/src/lib/chatThreadActions.ts": {
    upstream: UpstreamChatThreadActions,
    substitute: OurChatThreadActions satisfies typeof UpstreamChatThreadActions,
    importers: {
      "apps/web/src/hooks/useHandleNewThread.ts": [
        "../lib/chatThreadActions",
        ["resolveNewThreadModelSelectionOverride"],
      ],
    },
  },
  "packages/shared/src/t3McpToolPresentation.ts": {
    upstream: UpstreamT3McpTools,
    substitute: OurT3McpTools satisfies typeof UpstreamT3McpTools,
    importers: {
      "apps/web/src/components/chat/MessagesTimeline.logic.ts": [
        "@t3tools/shared/t3McpToolPresentation",
        ["resolveT3McpToolDefinition"],
      ],
      "packages/client-runtime/src/work-log/presentation.ts": [
        "@t3tools/shared/t3McpToolPresentation",
        ["resolveT3McpToolDefinition"],
      ],
    },
  },
  "packages/client-runtime/src/t3ToolSummary.ts": {
    upstream: UpstreamT3ToolSummary,
    substitute: OurT3ToolSummary satisfies typeof UpstreamT3ToolSummary,
    importers: {
      "packages/client-runtime/src/work-log/presentation.ts": [
        "@t3tools/client-runtime/t3ToolSummary",
        ["summarizeT3ToolCalls"],
      ],
    },
  },
  "apps/web/src/components/chat/MessagesTimeline.logic.ts": {
    upstream: UpstreamTimelineLogic,
    substitute: OurTimelineLogic satisfies typeof UpstreamTimelineLogic,
    importers: {
      "apps/web/src/components/chat/TimelineWorkEntryRow.tsx": [
        "./MessagesTimeline.logic",
        ["threadReadLabelPrefix"],
      ],
      // Upstream derives the transcript's rows in this hook now.
      "apps/web/src/components/chat/useTimelineRows.ts": [
        "./MessagesTimeline.logic",
        ["deriveMessagesTimelineRowsWithState"],
      ],
    },
  },
  "apps/web/src/components/chat/UsageLimitRecoveryBanner.tsx": {
    upstream: UpstreamUsageLimitRecoveryBanner,
    substitute: OurUsageLimitRecoveryBanner satisfies typeof UpstreamUsageLimitRecoveryBanner,
    importers: {
      "apps/web/src/components/ChatView.tsx": [
        "./chat/UsageLimitRecoveryBanner",
        ["usageLimitRecoveryBannerItem"],
      ],
    },
  },
  "apps/web/src/components/chat/ProviderModelPicker.tsx": {
    upstream: UpstreamProviderModelPicker,
    substitute: OurProviderModelPicker satisfies RendersOrNothing<
      typeof UpstreamProviderModelPicker
    >,
    importers: {
      "apps/web/src/components/chat/ComposerFooterControls.tsx": [
        "./ProviderModelPicker",
        ["ProviderModelPicker"],
      ],
      "apps/web/src/components/settings/SourceControlWritingSettings.tsx": [
        "../chat/ProviderModelPicker",
        ["ProviderModelPicker"],
      ],
      "apps/web/src/components/settings/SettingsPanels.tsx": [
        "../chat/ProviderModelPicker",
        ["ProviderModelPicker"],
      ],
      "apps/web/src/components/settings/ProjectDefaultsSettings.tsx": [
        "../chat/ProviderModelPicker",
        ["ProviderModelPicker"],
      ],
      "apps/web/src/components/settings/ScheduledTasksSettings.tsx": [
        "../chat/ProviderModelPicker",
        ["ProviderModelPicker"],
      ],
    },
  },
  "apps/web/src/components/ThreadTerminalDrawer.tsx": {
    upstream: UpstreamThreadTerminalDrawer,
    substitute: OurThreadTerminalDrawer satisfies RendersOrNothing<
      typeof UpstreamThreadTerminalDrawer
    >,
    importers: {
      // The drawer is its default export (terminal.contract.test.ts).
      "apps/web/src/components/PersistentThreadTerminals.tsx": ["./ThreadTerminalDrawer", []],
      "apps/web/src/components/settings/ProviderAuthTerminal.tsx": [
        "../ThreadTerminalDrawer",
        ["terminalThemeFromApp"],
      ],
    },
  },
  "apps/web/src/components/chat/ComposerStashBadge.tsx": {
    upstream: UpstreamComposerStashBadge,
    substitute: OurComposerStashBadge satisfies RendersOrNothing<typeof UpstreamComposerStashBadge>,
    importers: {
      "apps/web/src/components/chat/ChatComposer.tsx": [
        "./ComposerStashBadge",
        ["ComposerStashBadge"],
      ],
    },
  },
  "apps/web/src/lib/visibleAnimation.ts": {
    upstream: UpstreamVisibleAnimation,
    substitute: OurVisibleAnimation satisfies typeof UpstreamVisibleAnimation,
    importers: {
      // The live rows: the one wave of light rides in on this.
      "apps/web/src/components/chat/MessagesTimeline.tsx": [
        "../../lib/visibleAnimation",
        ["observeVisibleAnimation"],
      ],
      "apps/web/src/components/chat/WorktreeSetupCard.tsx": [
        "~/lib/visibleAnimation",
        ["observeVisibleAnimation"],
      ],
      "apps/web/src/components/ui/spinner.tsx": [
        "~/lib/visibleAnimation",
        ["observeVisibleAnimation"],
      ],
      "apps/web/src/components/ui/refresh-icon.tsx": [
        "~/lib/visibleAnimation",
        ["observeVisibleAnimation"],
      ],
    },
  },
  "packages/shared/src/themePalettes.ts": {
    upstream: UpstreamThemePalettes,
    substitute: OurThemePalettes satisfies typeof UpstreamThemePalettes,
    importers: {
      "apps/web/src/themePalette.ts": [
        "@t3tools/shared/themePalettes",
        ["BUILT_IN_THEMES", "RESERVED_THEME_IDS"],
      ],
      "apps/web/src/components/CommandPaletteThemeItems.tsx": [
        "@t3tools/shared/themePalettes",
        ["BUILT_IN_THEMES"],
      ],
    },
    serverKeepsUpstream:
      "The server publishes Stemcells' theme for other clients, so the id the web reserves for its built-in must stay open to it.",
  },
  "apps/web/src/components/usage/usageProviders.ts": {
    upstream: UpstreamUsageProviders,
    substitute: OurUsageProviders satisfies typeof UpstreamUsageProviders,
    importers: {
      // The chart's lines and areas, the legend's dots, the models' bars.
      "apps/web/src/components/usage/UsageProviderChart.tsx": [
        "./usageProviders",
        ["PROVIDER_PRESENTATION"],
      ],
      "apps/web/src/components/usage/UsagePage.tsx": [
        "./usageProviders",
        ["PROVIDER_PRESENTATION"],
      ],
      // The plan bars, which the rail's plan rings take too.
      "apps/web/src/components/usage/UsageLimits.tsx": [
        "./usageProviders",
        ["PROVIDER_PRESENTATION"],
      ],
    },
  },
  "apps/web/src/components/chat/useChatShortcuts.ts": {
    upstream: UpstreamUseChatShortcuts,
    substitute: OurUseChatShortcuts satisfies typeof UpstreamUseChatShortcuts,
    importers: {
      // Its window shortcuts and type-to-focus, gated by the window's input.
      "apps/web/src/components/ChatView.tsx": ["./chat/useChatShortcuts", ["useChatShortcuts"]],
    },
  },
  "apps/web/src/components/chat/OpenInPicker.tsx": {
    upstream: UpstreamOpenInPicker,
    substitute: OurOpenInPicker satisfies RendersOrNothing<typeof UpstreamOpenInPicker>,
    importers: {
      // The chat's details panel, where ChatView hands the open-in shortcut.
      "apps/web/src/components/chat/ThreadDetailsPanel.tsx": ["./OpenInPicker", ["OpenInPicker"]],
      // A file the workbench shows, which has the shortcut while it's open.
      "apps/web/src/components/files/FilePreviewPanel.tsx": [
        "~/components/chat/OpenInPicker",
        ["OpenInPicker"],
      ],
    },
  },
};

const substitutePath = (upstream: string) => NodePath.join(here, SUBSTITUTES[upstream]!);

/** Every (specifier, upstream importer) pair, and the file it must resolve to. */
const expectations = Object.entries(CASES).flatMap(([upstream, { importers }]) =>
  Object.entries(importers).map(([importer, [specifier]]) => ({
    key: `${specifier} from ${importer}`,
    specifier,
    // How our own folder would name the same module.
    ownSpecifier: specifier.startsWith(".") ? fromRepo(upstream) : specifier,
    importer: fromRepo(importer),
    upstream: fromRepo(upstream),
    substitute: substitutePath(upstream),
  })),
);

async function configFor(command: ConfigEnv["command"]): Promise<UserConfig> {
  const env: ConfigEnv = { command, mode: command === "build" ? "production" : "development" };
  return typeof webConfig === "function" ? await webConfig(env) : await webConfig;
}

function importedNames(source: string, specifier: string): string[] {
  const from = specifier.replaceAll(/[/.]/g, (char) => `\\${char}`);
  const pattern = new RegExp(`(?:import|export)\\s*\\{([^}]*)\\}\\s*from\\s*["']${from}["']`, "g");
  return [...source.matchAll(pattern)].flatMap((match) =>
    match[1]!.split(",").map((name) => name.trim().replace(/^type\s+/, "")),
  );
}

describe("Stemcells' substitutes for upstream modules", () => {
  it("has a case here for every substitute, and every file exists", () => {
    expect(Object.keys(CASES).toSorted()).toEqual(Object.keys(SUBSTITUTES).toSorted());
    for (const upstream of Object.keys(SUBSTITUTES)) {
      expect(NodeFS.existsSync(fromRepo(upstream)), upstream).toBe(true);
      expect(NodeFS.existsSync(substitutePath(upstream)), SUBSTITUTES[upstream]).toBe(true);
    }
  });

  it("each substitute exports every name its upstream module does", () => {
    for (const [upstream, { upstream: theirs, substitute: ours }] of Object.entries(CASES)) {
      expect(Object.keys(ours).toSorted(), upstream).toEqual(Object.keys(theirs).toSorted());
    }
  });

  it("upstream's views still import what we replace from the substituted module", () => {
    // A view that took the name from somewhere else would bypass the substitute.
    for (const { importers } of Object.values(CASES)) {
      for (const [importer, [specifier, names]] of Object.entries(importers)) {
        const source = NodeFS.readFileSync(fromRepo(importer), "utf8");
        expect(importedNames(source, specifier), importer).toEqual(
          expect.arrayContaining([...names]),
        );
      }
    }
  });

  it("the web app's config builds every target with the substitutes", async () => {
    // Dev and the production build use the config's plugins; both test
    // projects (unit and browser) inherit them through `extends: true`.
    for (const command of ["serve", "build"] as const) {
      const config = await configFor(command);
      const names = (config.plugins ?? []).flat().map((plugin) => (plugin as Plugin)?.name);
      expect(names, command).toContain(substituteUpstreamModules().name);
      const projects = (config.test?.projects ?? []) as ReadonlyArray<{ extends?: unknown }>;
      expect(projects.length, command).toBeGreaterThan(0);
      for (const project of projects) expect(project.extends, command).toBe(true);
    }
  });

  it("vitest: this test run hands upstream's code the substitute", () => {
    // `lib/favicon.ts` is upstream's: it re-exports `@t3tools/shared/favicon`.
    expect(
      UpstreamFaviconReexport.faviconUrlForOrigin,
      "run the web's tests with apps/web's config: pnpm --filter @t3tools/web exec vp test run …",
    ).toBe(OurFavicon.faviconUrlForOrigin);
  });

  it("dev: the dev server resolves upstream's imports to the substitutes", async () => {
    const config = await configFor("serve");
    const server = await createServer({
      ...config,
      configFile: false,
      root: webRoot,
      logLevel: "silent",
      server: { middlewareMode: true, hmr: false, ws: false, warmup: {} },
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    try {
      const container = server.environments.client.pluginContainer;
      const ours = NodePath.join(here, "plugin.ts");
      for (const { key, specifier, ownSpecifier, importer, upstream, substitute } of expectations) {
        expect((await container.resolveId(specifier, importer))?.id, key).toBe(substitute);
        // Our own folder gets upstream's module, so a substitute can wrap it.
        expect((await container.resolveId(ownSpecifier, ours))?.id, key).toBe(upstream);
      }
      const served = await server.transformRequest("/src/lib/favicon.ts");
      expect(served?.code).toContain("/src/stemcells/upstream/substitutes/favicon.ts");
    } finally {
      await server.close();
    }
  });

  it("build: the production build (what the desktop app ships) bundles the substitutes", async () => {
    // The server's build copies the web's build into the bundle the desktop
    // app serves its window from.
    const serverBuild = NodeFS.readFileSync(fromRepo("apps/server/scripts/cli.ts"), "utf8");
    expect(serverBuild).toContain('"apps/web/dist"');

    const resolved = new Map<string, string | undefined>();
    const probe: Plugin = {
      name: "stemcells:substitutes-probe",
      async buildStart() {
        for (const { key, specifier, importer } of expectations) {
          resolved.set(key, (await this.resolve(specifier, importer))?.id);
        }
      },
    };
    const config = await configFor("build");
    const output = await build({
      ...config,
      configFile: false,
      root: webRoot,
      logLevel: "silent",
      plugins: [...(config.plugins ?? []), probe],
      build: {
        write: false,
        minify: false,
        sourcemap: false,
        manifest: false,
        emptyOutDir: false,
        rollupOptions: {
          input: NodePath.join(webRoot, "src/lib/favicon.ts"),
          preserveEntrySignatures: "strict",
        },
      },
    });
    for (const { key, substitute } of expectations) expect(resolved.get(key), key).toBe(substitute);

    const outputs = (Array.isArray(output) ? output : [output]).flatMap((result) =>
      "output" in result ? result.output : [],
    );
    const moduleIds = outputs.flatMap((chunk) => ("moduleIds" in chunk ? chunk.moduleIds : []));
    // The substitute only re-exports, so the bundle holds what it re-exports.
    expect(moduleIds).toContain(NodePath.join(here, "../favicon.ts"));
  });

  it("server: imports none of the substituted modules, so needs no substitute", () => {
    // The server runs from source in dev (`node src/bin.ts`), with no bundler
    // to substitute through. A server import of one of these would get
    // upstream's module: give the server a seam of its own instead. Its
    // tests may read upstream's (the server's T3 tools are upstream's).
    const specifiers = Object.values(CASES)
      .filter(({ serverKeepsUpstream }) => serverKeepsUpstream === undefined)
      .flatMap(({ importers }) =>
        Object.values(importers)
          .map(([specifier]) => specifier)
          .filter((specifier) => specifier.startsWith("@")),
      );
    const serverSource = NodePath.join(repoRoot, "apps/server/src");
    const offenders = NodeFS.readdirSync(serverSource, { recursive: true })
      .map(String)
      .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
      .filter((file) => !file.startsWith(`stemcells${NodePath.sep}`))
      .filter((file) => {
        const source = NodeFS.readFileSync(NodePath.join(serverSource, file), "utf8");
        return specifiers.some((specifier) => source.includes(`"${specifier}"`));
      });
    expect(offenders).toEqual([]);
  });
});
