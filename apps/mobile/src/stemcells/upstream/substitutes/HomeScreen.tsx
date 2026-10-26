// Replaces `features/home/HomeScreen.tsx` (`substitutes.cjs`): the home shows one tab of Cells
// at a time (`home/tabs.ts`), under Aski. T3's list keeps all it does, handed the tab's Cells,
// and its header (`ThreadListFilters`) reads the tabs from context. Where T3's list has no
// header (Android, outside the workspace) and while searching, the home is T3's own.
import { useIsFocused } from "@react-navigation/native";
import { use } from "react";
import { Platform, View } from "react-native";

import * as Upstream from "../../../features/home/HomeScreen";
import { ThreadListFilters } from "../../../features/home/ThreadListFilters";
import { askiChatsOf } from "../../aski/chat";
import { CopyLayer } from "../../home/CopyLayer";
import { EmptyTab } from "../../home/EmptyTab";
import { chooseTab, HomeInFront, HomeTabsContext, useHomeTab, useMinute } from "../../home/state";
import { countsOf, inTab } from "../../home/tabs";
import { NativePrimaryColumnContext, useWorkspaceTabs } from "../home";
import { buildHomeProjectScopes, findHomeProjectScope } from "../threads";

export * from "../../../features/home/HomeScreen";

export function HomeScreen(props: Parameters<typeof Upstream.HomeScreen>[0]) {
  const workspace = useWorkspaceTabs();
  const primaryColumn = use(NativePrimaryColumnContext);
  const inFront = useIsFocused();
  const now = useMinute();
  const aski = askiChatsOf(props.threads);
  const cells = props.threads.filter(
    (thread) =>
      thread.archivedAt === null &&
      thread.lineage.relationshipToParent !== "subagent" &&
      !aski.has(thread.id),
  );
  const scopes = buildHomeProjectScopes({
    projects: props.projects,
    environmentId: props.selectedEnvironmentId,
    projectGroupingMode: props.projectGroupingMode,
  });
  const scope = findHomeProjectScope(scopes, props.selectedProjectKey);
  const inScope = (thread: (typeof cells)[number]) =>
    (props.selectedEnvironmentId === null ||
      thread.environmentId === props.selectedEnvironmentId) &&
    (scope === null ||
      scope.projectRefs.some(
        (ref) => ref.environmentId === thread.environmentId && ref.projectId === thread.projectId,
      ));
  const counts = countsOf(cells.filter(inScope), now);
  const ready = props.catalogState.hasLoadedShellSnapshot && props.projects.length > 0;
  const tab = useHomeTab(counts, ready);
  const tabbed =
    Platform.OS === "ios" && workspace !== null && ready && props.searchQuery.trim() === "";
  if (!tabbed)
    return (
      <HomeInFront value={inFront}>
        <Upstream.HomeScreen {...props} />
      </HomeInFront>
    );
  const shown = cells.filter((thread) => inTab(thread, tab, now));
  const pendingTasks = tab === "active" ? props.pendingTasks : [];
  const tabs = { tab, counts, choose: chooseTab, environmentId: props.selectedEnvironmentId };
  return (
    <HomeInFront value={inFront}>
      <HomeTabsContext value={tabs}>
        {shown.length === 0 && pendingTasks.length === 0 ? (
          <EmptyTab
            tab={tab}
            filters={
              <ThreadListFilters
                gutter={primaryColumn ? 8 : 0}
                environments={props.environments}
                projects={scopes.map((project) => ({ key: project.key, label: project.title }))}
                selectedEnvironmentId={props.selectedEnvironmentId}
                selectedProjectKey={props.selectedProjectKey}
                onEnvironmentChange={props.onEnvironmentChange}
                onProjectChange={props.onProjectChange}
              />
            }
          />
        ) : (
          <View style={{ flex: 1 }}>
            <Upstream.HomeScreen {...props} threads={shown} pendingTasks={pendingTasks} />
            <CopyLayer />
          </View>
        )}
      </HomeTabsContext>
    </HomeInFront>
  );
}
