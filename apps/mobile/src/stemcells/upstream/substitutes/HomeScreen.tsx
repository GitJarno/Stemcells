// Replaces `features/home/HomeScreen.tsx` (`substitutes.cjs`): the Cells' line under Aski, T3's
// list handed each segment's Cells, a list per segment. In the iOS workspace our picks narrow it
// (`home/scope.tsx`) and T3's own pick stays unset. Where it has no header (Android, outside the
// workspace) and searching, T3's.
import { useIsFocused } from "@react-navigation/native";
import { type ReactNode } from "react";
import { Platform } from "react-native";

import * as Upstream from "../../../features/home/HomeScreen";
import { askiChatsOf } from "../../aski/chat";
import { HomeFront } from "../../home/HomeFront";
import { inEffect, NO_PICKS, type Picks } from "../../home/picks";
import { useMinute } from "../../home/state";
import { setPicks, usePicks } from "../../home/usePicks";
import { movedByHand } from "../../line/kit";
import { LineHome } from "../../line/LineHome";
import { useKeepReading, useReadings } from "../../line/readings";
import {
  type OlderSettledScope,
  useOlderSettledShelf,
  useWorkspaceTabs,
  WorkspaceTabsContext,
} from "../home";
import { buildHomeProjectScopes } from "../threads";

export * from "../../../features/home/HomeScreen";

type Props = Parameters<typeof Upstream.HomeScreen>[0];
type Place = { readonly environmentId: string; readonly projectId: string };

export function HomeScreen(props: Props) {
  const workspace = useWorkspaceTabs();
  const inFront = useIsFocused();
  const now = useMinute();
  const readings = useReadings();
  const picked = usePicks();
  const ours = Platform.OS === "ios" && workspace !== null;
  const scope = scopeOf(ours ? picked : NO_PICKS, props);
  // The settled chats each server keeps back from the phone, counted with those it holds.
  const older = useOlderSettledShelf({
    scopes: scope.olderScopes,
    expanded: false,
    visibleCount: 0,
  });
  const olderSettled = older.unloadedCount(
    props.threads.filter((thread) => thread.archivedAt === null && scope.inView(thread)),
  );
  const { catalogState } = props;
  const ready = catalogState.hasLoadedShellSnapshot && props.projects.length > 0;
  // A saved machine on its way: the home stands as it will, so nothing swaps in under it.
  const connecting =
    catalogState.hasConnectingEnvironment &&
    !catalogState.hasLoadedShellSnapshot &&
    catalogState.connectionError === null;
  const tabbed = ours && (ready || connecting) && props.searchQuery.trim() === "";
  useKeepReading(props.threads, now, inFront && tabbed);
  // T3's own pick narrows nothing where ours do, or a pick made before ours hides Cells unseen.
  const upstream = ours
    ? { ...props, selectedEnvironmentId: null, selectedProjectKey: null }
    : props;
  if (!tabbed)
    return (
      <HomeFront inFront={inFront}>
        <Upstream.HomeScreen
          {...upstream}
          threads={ours ? props.threads.filter((thread) => scope.inView(thread)) : props.threads}
        />
      </HomeFront>
    );

  const aski = askiChatsOf(props.threads);
  const cells = props.threads.filter(
    (thread) =>
      thread.archivedAt === null &&
      thread.lineage.relationshipToParent !== "subagent" &&
      !aski.has(thread.id),
  );
  const list = (threads: Props["threads"], pending: boolean) => (
    <FromTheTop>
      <Upstream.HomeScreen
        {...upstream}
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
    </FromTheTop>
  );

  return (
    <HomeFront inFront={inFront}>
      <LineHome
        cells={cells}
        readings={readings}
        known={scope.machines.every((id) => readings.has(id))}
        connecting={!ready}
        now={now}
        inView={scope.inView}
        projects={scope.everywhere.map((project) => ({
          key: project.key,
          name: project.title,
          memberKeys: project.projectRefs.map((ref) => `${ref.environmentId}:${ref.projectId}`),
        }))}
        narrowedTo={scope.narrowedTo}
        environmentId={scope.machine}
        onShowAll={() => setPicks(NO_PICKS)}
        settle={props.onSettleThread}
        pending={props.pendingTasks.length}
        olderSettled={olderSettled}
        renderList={list}
      />
    </HomeFront>
  );
}

/**
 * T3's list keeps one scroll offset for the workspace's Threads tab and puts it back each time
 * it mounts, so a segment opened where another was scrolled, Aski under the header. In the home
 * each segment opens at its top; the offset still follows the list for T3's search.
 */
function FromTheTop(props: { readonly children: ReactNode }) {
  const workspace = useWorkspaceTabs();
  if (workspace === null) return props.children;
  const { state } = workspace;
  const threads = { ...state.tabs.threads, scrollOffset: 0 };
  return (
    <WorkspaceTabsContext
      value={{
        ...workspace,
        getScrollOffset: (tab) => (tab === "threads" ? 0 : workspace.getScrollOffset(tab)),
        state: { ...state, tabs: { ...state.tabs, threads } },
      }}
    >
      {props.children}
    </WorkspaceTabsContext>
  );
}

/** What the picks narrow the home to, from the machines and projects that still exist. */
function scopeOf(picks: Picks, props: Props) {
  const allMachines = props.environments.map((environment) => String(environment.environmentId));
  const pickedMachines = inEffect(picks.machines, allMachines);
  const everywhere = buildHomeProjectScopes({
    projects: props.projects,
    environmentId: null,
    projectGroupingMode: props.projectGroupingMode,
  });
  // As the header lists them: the projects on the machines picked; one on none narrows nothing.
  const listed = everywhere.filter(
    (project) =>
      pickedMachines.length === 0 ||
      project.projectRefs.some((ref) => pickedMachines.includes(String(ref.environmentId))),
  );
  const pickedProjects = inEffect(
    picks.projects,
    listed.map((project) => project.key),
  );
  const chosen = listed.filter((project) => pickedProjects.includes(project.key));
  const projectKeys = new Set(
    chosen.flatMap((project) =>
      project.projectRefs.map((ref) => `${ref.environmentId}:${ref.projectId}`),
    ),
  );
  const machineLabels = props.environments
    .filter((environment) => pickedMachines.includes(String(environment.environmentId)))
    .map((environment) => environment.label);
  const olderScopes = props.environments.flatMap(({ environmentId }): OlderSettledScope[] => {
    if (pickedMachines.length > 0 && !pickedMachines.includes(String(environmentId))) return [];
    if (chosen.length === 0) return [{ environmentId, projectIds: null }];
    const projectIds = chosen.flatMap((project) =>
      project.projectRefs.flatMap((ref) =>
        ref.environmentId === environmentId ? [ref.projectId] : [],
      ),
    );
    return projectIds.length === 0 ? [] : [{ environmentId, projectIds }];
  });
  return {
    everywhere,
    /** Where the servers' older settled chats are counted: the machines and projects in view. */
    olderScopes,
    machines: pickedMachines.length > 0 ? pickedMachines : allMachines,
    /** The one machine picked, whose Aski the header opens. */
    machine: pickedMachines.length === 1 ? (pickedMachines[0] ?? null) : null,
    inView: (place: Place) =>
      (pickedMachines.length === 0 || pickedMachines.includes(String(place.environmentId))) &&
      (projectKeys.size === 0 || projectKeys.has(`${place.environmentId}:${place.projectId}`)),
    /** What the pickers show, when they narrow the home: "in Harbor", "on Studio". */
    narrowedTo:
      chosen.length === 1
        ? `in ${chosen[0]?.title}`
        : chosen.length > 1
          ? "in these projects"
          : machineLabels.length === 1
            ? `on ${machineLabels[0]}`
            : machineLabels.length > 1
              ? "on these machines"
              : null,
  };
}
