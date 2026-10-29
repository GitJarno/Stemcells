// Replaces `features/home/HomeScreen.tsx` (`substitutes.cjs`): the Cells' line under Aski
// (`line/LineHome.tsx`) where the machines in view read it, else one tab of Cells at a time
// (`home/tabs.ts`); T3's list keeps all it does, handed the tab's Cells. Where it has no header
// (Android, outside the workspace) and while searching, the home is T3's own.
import { useIsFocused } from "@react-navigation/native";
import { use, type ReactNode } from "react";
import { Platform, View } from "react-native";

import * as Upstream from "../../../features/home/HomeScreen";
import { ThreadListFilters } from "../../../features/home/ThreadListFilters";
import { askiChatsOf } from "../../aski/chat";
import { CopyLayer } from "../../home/CopyLayer";
import { EmptyTab } from "../../home/EmptyTab";
import { HomeFront } from "../../home/HomeFront";
import { HomeTabsContext, tabChoice, useMinute } from "../../home/state";
import { countsOf, HOME_TABS, type HomeTab, inTab } from "../../home/tabs";
import { movedByHand } from "../../line/kit";
import { lineApplies } from "../../line/line";
import { LineHome } from "../../line/LineHome";
import { useKeepReading, useReadings } from "../../line/readings";
import { NativePrimaryColumnContext, useWorkspaceTabs } from "../home";
import { buildHomeProjectScopes, findHomeProjectScope } from "../threads";

export * from "../../../features/home/HomeScreen";

type Props = Parameters<typeof Upstream.HomeScreen>[0];

const tabs = tabChoice<HomeTab>();

const EMPTY: Readonly<Record<HomeTab, string>> = {
  asleep: "No Cells asleep.",
  active: "No Cells awake.",
  working: "No Cells flying.",
  input: "Nothing waits on you.",
};

export function HomeScreen(props: Props) {
  const workspace = useWorkspaceTabs();
  const primaryColumn = use(NativePrimaryColumnContext);
  const inFront = useIsFocused();
  const now = useMinute();
  const readings = useReadings();
  const ready = props.catalogState.hasLoadedShellSnapshot && props.projects.length > 0;
  const tabbed =
    Platform.OS === "ios" && workspace !== null && ready && props.searchQuery.trim() === "";
  useKeepReading(props.threads, now, inFront && tabbed);
  if (!tabbed)
    return (
      <HomeFront inFront={inFront}>
        <Upstream.HomeScreen {...props} />
      </HomeFront>
    );

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
  const inView = (place: { readonly environmentId: string; readonly projectId: string }) =>
    (props.selectedEnvironmentId === null || place.environmentId === props.selectedEnvironmentId) &&
    (scope === null ||
      scope.projectRefs.some(
        (ref) => ref.environmentId === place.environmentId && ref.projectId === place.projectId,
      ));
  const filters = (
    <ThreadListFilters
      gutter={primaryColumn ? 8 : 0}
      environments={props.environments}
      projects={scopes.map((project) => ({ key: project.key, label: project.title }))}
      selectedEnvironmentId={props.selectedEnvironmentId}
      selectedProjectKey={props.selectedProjectKey}
      onEnvironmentChange={props.onEnvironmentChange}
      onProjectChange={props.onProjectChange}
    />
  );
  const list = (threads: Props["threads"], pending: boolean) => (
    <Upstream.HomeScreen
      {...props}
      threads={threads}
      pendingTasks={pending ? props.pendingTasks : []}
      // A settle or its undo from T3's own rows is the person's move: its Cell hops.
      onSettleThread={(thread) => {
        movedByHand(thread.id);
        return props.onSettleThread(thread);
      }}
      onUnsettleThread={(thread) => {
        movedByHand(thread.id);
        props.onUnsettleThread(thread);
      }}
    />
  );
  const machines =
    props.selectedEnvironmentId === null
      ? props.environments.map((environment) => environment.environmentId)
      : [props.selectedEnvironmentId];

  if (lineApplies(readings, machines)) {
    const everywhere = buildHomeProjectScopes({
      projects: props.projects,
      environmentId: null,
      projectGroupingMode: props.projectGroupingMode,
    });
    const machine = props.environments.find(
      (environment) => environment.environmentId === props.selectedEnvironmentId,
    );
    return (
      <HomeFront inFront={inFront}>
        <LineHome
          cells={cells}
          readings={readings}
          known={machines.every((id) => readings.has(id))}
          now={now}
          inView={inView}
          projects={everywhere.map((project) => ({
            key: project.key,
            name: project.title,
            memberKeys: project.projectRefs.map((ref) => `${ref.environmentId}:${ref.projectId}`),
          }))}
          projectName={(place) =>
            props.projects.find(
              (project) =>
                project.environmentId === place.environmentId && project.id === place.projectId,
            )?.title ?? null
          }
          narrowedTo={scope !== null ? `in ${scope.title}` : machine ? `on ${machine.label}` : null}
          environmentId={props.selectedEnvironmentId}
          filters={filters}
          onShowAll={() => {
            props.onEnvironmentChange(null);
            props.onProjectChange(null);
          }}
          settle={props.onSettleThread}
          pending={props.pendingTasks.length}
          renderList={list}
        />
      </HomeFront>
    );
  }

  return (
    <HomeFront inFront={inFront}>
      <Tabs
        cells={cells.filter(inView)}
        now={now}
        environmentId={props.selectedEnvironmentId}
        filters={filters}
        renderList={(threads, pending) => (
          <View style={{ flex: 1 }}>
            {list(threads, pending)}
            <CopyLayer />
          </View>
        )}
        pending={props.pendingTasks.length}
      />
    </HomeFront>
  );
}

/** A machine without the line: Asleep, Active, Working and Input, from the chats' shells. */
function Tabs(props: {
  readonly cells: Props["threads"];
  readonly now: string;
  readonly environmentId: string | null;
  readonly filters: ReactNode;
  readonly renderList: (threads: Props["threads"], pending: boolean) => ReactNode;
  readonly pending: number;
}) {
  const counts = countsOf(props.cells, props.now);
  const tab = tabs.useTab(counts.input > 0 ? "input" : "active", true);
  const shown = props.cells.filter((thread) => inTab(thread, tab, props.now));
  const pending = tab === "active" && props.pending > 0;
  const home = {
    tab,
    options: HOME_TABS.map(({ id, label }) => ({ id, label, count: counts[id] })),
    counts,
    night: tab === "asleep",
    choose: (id: string) => tabs.choose(id as HomeTab),
    environmentId: props.environmentId,
  };
  return (
    <HomeTabsContext value={home}>
      {shown.length === 0 && !pending ? (
        <EmptyTab words={EMPTY[tab]} filters={props.filters} />
      ) : (
        props.renderList(shown, pending)
      )}
    </HomeTabsContext>
  );
}
