// The home's scope in its header's top right: projects, and with two machines or more, machines,
// each a menu that stays open while you tick any number (`picks.ts`), then the plan ring. Unticked,
// a plain glyph; ticked, the projects' own icons or the machine's symbol, tinted. T3's workspace
// toolbar hands its trailing items here at its seam (`features/layout/workspace/WorkspaceToolbar.tsx`).

import { type ReactElement } from "react";
import { View } from "react-native";

import { chargeWords } from "../../../../../stemcells/words/battery.ts";
import { fillColour } from "../battery/marks";
import { useBatteries } from "../battery/useBatteries";
import { useAppearancePreferences } from "../upstream/battery";
import { PlanRing } from "../limits/PlanRing";
import { ProjectMark } from "../project/ProjectMark";
import { buildHomeProjectScopes } from "../upstream/cells";
import { useHasLimits } from "../upstream/limits";
import {
  ENVIRONMENT_MACHINE_SYMBOLS,
  Menu,
  SymbolView,
  Toolbar,
  useHomeListOptions,
  useMachineKinds,
  useProjects,
  useSavedRemoteConnections,
} from "../upstream/home";
import { inEffect, toggled } from "./picks";
import { holdSkyAnchor, movedSkyAnchor } from "./skyAnchor";
import { useMinute } from "./state";
import { setPicks, usePicks } from "./usePicks";

const ALL = "all";

/** The machines the phone knows, by name. */
function useMachineList() {
  const { savedConnectionsById } = useSavedRemoteConnections();
  const kinds = useMachineKinds();
  return Object.values(savedConnectionsById)
    .map((connection) => ({
      id: connection.environmentId,
      label: connection.environmentLabel,
      kind: kinds.get(connection.environmentId),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * The machines' menu, from the scope's button and from the charge beside the app's name: each
 * machine's row carries its charge. With one machine there is nothing to narrow to.
 */
export function useMachinesMenu() {
  const machines = useMachineList();
  const batteries = useBatteries();
  const { themeAppearance } = useAppearancePreferences();
  const now = Date.parse(useMinute());
  const picks = usePicks();
  const machineIds = machines.map((machine) => String(machine.id));
  const picked = inEffect(picks.machines, machineIds);
  const narrows = machines.length > 1;
  const rows = machines.map((machine) => {
    const battery = batteries.find((each) => each.environmentId === String(machine.id));
    const colour =
      battery === undefined || battery.away ? null : fillColour(battery, themeAppearance);
    return {
      id: String(machine.id),
      title: machine.label,
      image: ENVIRONMENT_MACHINE_SYMBOLS[machine.kind ?? "desktop"],
      state: picked.includes(String(machine.id)) ? ("on" as const) : ("off" as const),
      ...(colour === null ? {} : { imageColor: colour }),
      ...(battery === undefined
        ? {}
        : {
            subtitle: chargeWords(
              battery,
              battery.away ? Math.max(0, now - battery.heardAt) / 60_000 : null,
            ),
          }),
    };
  });
  return {
    title: "Machines",
    actions: narrows
      ? [
          { id: ALL, title: "All machines", state: picked.length === 0 ? "on" : "off" } as const,
          ...rows,
        ]
      : rows,
    onSelect: (id: string) => {
      if (!narrows) return;
      setPicks((current) => ({
        ...current,
        machines: id === ALL ? [] : toggled(inEffect(current.machines, machineIds), id, machineIds),
      }));
    },
  };
}

/** Its own component, so a charge's every reading redraws this button and not the whole toolbar. */
function MachinesButton() {
  const machines = useMachineList();
  const menu = useMachinesMenu();
  const picks = usePicks();
  const picked = inEffect(
    picks.machines,
    machines.map((machine) => String(machine.id)),
  );
  const first = machines.find((machine) => picked.includes(String(machine.id)));
  return (
    <ScopeButton
      title={menu.title}
      label={
        picked.length === 0
          ? "All machines"
          : `Machines: ${machines
              .filter((machine) => picked.includes(String(machine.id)))
              .map((machine) => machine.label)
              .join(", ")}`
      }
      actions={menu.actions}
      onSelect={menu.onSelect}
    >
      <SymbolView
        name={ENVIRONMENT_MACHINE_SYMBOLS[first?.kind ?? "desktop"]}
        size={18}
        tintColorClassName={first ? "accent-primary" : "accent-icon"}
      />
    </ScopeButton>
  );
}

export function useHomeScopeItems(): ReactElement[] {
  const hasLimits = useHasLimits();
  const projects = useProjects();
  const machines = useMachineList();
  const { options } = useHomeListOptions(new Set(machines.map((machine) => machine.id)));
  const picks = usePicks();
  const machineIds = machines.map((machine) => String(machine.id));
  const pickedMachines = inEffect(picks.machines, machineIds);
  // Keys from every machine's projects, so a pick holds as machines are ticked.
  const scopes = buildHomeProjectScopes({
    projects,
    environmentId: null,
    projectGroupingMode: options.projectGroupingMode,
  });
  const listed = scopes.filter(
    (scope) =>
      pickedMachines.length === 0 ||
      scope.projectRefs.some((ref) => pickedMachines.includes(String(ref.environmentId))),
  );
  const listedKeys = listed.map((scope) => scope.key);
  // A project on none of the machines picked narrows nothing, as the home reads it.
  const pickedProjects = inEffect(picks.projects, listedKeys);
  const chosen = listed.filter((scope) => pickedProjects.includes(scope.key));

  const items = [
    <Toolbar.Custom key="project">
      <ScopeButton
        holdsTheSky
        title="Projects"
        label={
          chosen.length === 0
            ? "All projects"
            : `Projects: ${chosen.map((scope) => scope.title).join(", ")}`
        }
        actions={[
          { id: ALL, title: "All projects", state: chosen.length === 0 ? "on" : "off" },
          ...listed.map((scope) => ({
            id: scope.key,
            title: scope.title,
            state: pickedProjects.includes(scope.key) ? ("on" as const) : ("off" as const),
          })),
        ]}
        onSelect={(id) =>
          setPicks((now) => ({
            ...now,
            projects: id === ALL ? [] : toggled(inEffect(now.projects, listedKeys), id, listedKeys),
          }))
        }
      >
        {chosen.length === 0 ? (
          <SymbolView name="folder" size={18} tintColorClassName="accent-icon" />
        ) : (
          <View className="flex-row items-center">
            {chosen.slice(0, 2).map((scope, index) => (
              <View key={scope.key} style={index > 0 ? { marginLeft: -6 } : undefined}>
                <ProjectMark project={scope.representative} size={chosen.length > 1 ? 18 : 22} />
              </View>
            ))}
          </View>
        )}
      </ScopeButton>
    </Toolbar.Custom>,
  ];
  if (machines.length > 1) {
    items.push(
      <Toolbar.Custom key="machine">
        <MachinesButton />
      </Toolbar.Custom>,
    );
  }
  if (hasLimits) {
    items.push(
      <Toolbar.Custom key="plan">
        <PlanRing />
      </Toolbar.Custom>,
    );
  }
  return items;
}

type ScopeMenuProps = {
  readonly title: string;
  readonly label: string;
  readonly actions: ReadonlyArray<{
    readonly id: string;
    readonly title: string;
    readonly subtitle?: string;
    readonly image?: string;
    readonly imageColor?: string;
    readonly state: "on" | "off";
  }>;
  readonly onSelect: (id: string) => void;
  readonly children: ReactElement;
};

/** `holdsTheSky`: the sun and the moon stand behind this one (`skyAnchor.ts`). */
function ScopeButton({
  holdsTheSky,
  ...props
}: ScopeMenuProps & { readonly holdsTheSky?: boolean }) {
  return (
    <ScopeMenu {...props}>
      <View
        ref={holdsTheSky ? holdSkyAnchor : undefined}
        onLayout={holdsTheSky ? movedSkyAnchor : undefined}
        className="size-9 items-center justify-center"
      >
        {props.children}
      </View>
    </ScopeMenu>
  );
}

export function ScopeMenu(props: ScopeMenuProps) {
  return (
    <Menu
      title={props.title}
      // Ticking leaves the menu open for the next tick; "All" closes it, being done.
      actions={props.actions.map((action) => ({
        ...action,
        attributes: { keepsMenuPresented: action.id !== ALL },
      }))}
      onPressAction={({ nativeEvent }) => props.onSelect(nativeEvent.event)}
      accessibilityLabel={props.label}
      accessibilityRole="button"
    >
      {props.children}
    </Menu>
  );
}
