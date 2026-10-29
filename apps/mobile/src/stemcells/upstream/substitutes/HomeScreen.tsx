// Replaces `features/home/HomeScreen.tsx` (`substitutes.cjs`): the Cells' line under Aski unless
// every machine says it has none, else one tab at a time (`home/tabs.ts`); T3's list gets the tab's
// Cells. In the iOS workspace our picks narrow it (`home/scope.tsx`) and T3's own pick stays
// unset. Where it has no header (Android, outside the workspace) and searching, it's T3's home.
import { useIsFocused } from "@react-navigation/native";
import { type ReactNode } from "react";
import { Platform, View } from "react-native";

import * as Upstream from "../../../features/home/HomeScreen";
import { askiChatsOf } from "../../aski/chat";
import { CopyLayer } from "../../home/CopyLayer";
import { EmptyTab } from "../../home/EmptyTab";
import { HomeFront } from "../../home/HomeFront";
import { inEffect, NO_PICKS, type Picks } from "../../home/picks";
import { HomeTabsContext, tabChoice, useMinute } from "../../home/state";
import { countsOf, HOME_TABS, type HomeTab, inTab } from "../../home/tabs";
import { setPicks, usePicks } from "../../home/usePicks";
import { movedByHand } from "../../line/kit";
import { lineApplies } from "../../line/line";
import { LineHome } from "../../line/LineHome";
import { useKeepReading, useReadings } from "../../line/readings";
import { useWorkspaceTabs } from "../home";
import { buildHomeProjectScopes } from "../threads";

export * from "../../../features/home/HomeScreen";

type Props = Parameters<typeof Upstream.HomeScreen>[0];
type Place = { readonly environmentId: string; readonly projectId: string };

const tabs = tabChoice<HomeTab>();

const EMPTY: Readonly<Record<HomeTab, string>> = {
  asleep: "No Cells asleep.",
  active: "No Cells awake.",
  working: "No Cells flying.",
  input: "Nothing waits on you.",
};

export function HomeScreen(props: Props) {
  const workspace = useWorkspaceTabs();
  const inFront = useIsFocused();
  const now = useMinute();
  const readings = useReadings();
  const picked = usePicks();
  const ours = Platform.OS === "ios" && workspace !== null;
  const scope = scopeOf(ours ? picked : NO_PICKS, props);
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
  );

  if (lineApplies(readings, scope.machines)) {
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
          renderList={list}
        />
      </HomeFront>
    );
  }

  return (
    <HomeFront inFront={inFront}>
      <Tabs
        cells={cells.filter(scope.inView)}
        now={now}
        environmentId={scope.machine}
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
  return {
    everywhere,
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

/** A machine without the line: Asleep, Active, Working and Input, from the chats' shells. */
function Tabs(props: {
  readonly cells: Props["threads"];
  readonly now: string;
  readonly environmentId: string | null;
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
        <EmptyTab words={EMPTY[tab]} />
      ) : (
        props.renderList(shown, pending)
      )}
    </HomeTabsContext>
  );
}
