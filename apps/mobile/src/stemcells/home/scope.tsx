// The home's scope in its header's top right: projects, and with two machines or more, machines,
// each a menu that stays open while you tick any number (`picks.ts`). Unticked, a plain glyph;
// ticked, the projects' own icons or the machine's symbol, tinted. T3's workspace toolbar hands
// its trailing items here at its seam (`features/workspace/WorkspaceToolbar.ios.tsx`).

import { type ReactElement } from "react";
import { View } from "react-native";

import { buildHomeProjectScopes } from "../upstream/cells";
import {
  ENVIRONMENT_MACHINE_SYMBOLS,
  Menu,
  ProjectFavicon,
  SymbolView,
  Toolbar,
  useHomeListOptions,
  useMachineKinds,
  useProjects,
  useSavedRemoteConnections,
} from "../upstream/home";
import { inEffect, toggled } from "./picks";
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

export function useHomeScopeItems(): ReactElement[] {
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
              <View key={scope.key} style={index > 0 ? { marginLeft: -8 } : undefined}>
                <ProjectFavicon
                  environmentId={scope.representative.environmentId}
                  faviconPath={scope.representative.faviconPath}
                  projectIcon={scope.representative.projectIcon}
                  projectTitle={scope.title}
                  workspaceRoot={scope.representative.workspaceRoot}
                  size={chosen.length > 1 ? 16 : 20}
                />
              </View>
            ))}
          </View>
        )}
      </ScopeButton>
    </Toolbar.Custom>,
  ];
  if (machines.length < 2) return items;
  const first = machines.find((machine) => pickedMachines.includes(String(machine.id)));
  items.push(
    <Toolbar.Custom key="machine">
      <ScopeButton
        title="Machines"
        label={
          pickedMachines.length === 0
            ? "All machines"
            : `Machines: ${machines
                .filter((machine) => pickedMachines.includes(String(machine.id)))
                .map((machine) => machine.label)
                .join(", ")}`
        }
        actions={[
          { id: ALL, title: "All machines", state: pickedMachines.length === 0 ? "on" : "off" },
          ...machines.map((machine) => ({
            id: String(machine.id),
            title: machine.label,
            image: ENVIRONMENT_MACHINE_SYMBOLS[machine.kind ?? "desktop"],
            state: pickedMachines.includes(String(machine.id)) ? ("on" as const) : ("off" as const),
          })),
        ]}
        onSelect={(id) =>
          setPicks((now) => ({
            ...now,
            machines: id === ALL ? [] : toggled(inEffect(now.machines, machineIds), id, machineIds),
          }))
        }
      >
        <SymbolView
          name={ENVIRONMENT_MACHINE_SYMBOLS[first?.kind ?? "desktop"]}
          size={18}
          tintColorClassName={first ? "accent-primary" : "accent-icon"}
        />
      </ScopeButton>
    </Toolbar.Custom>,
  );
  return items;
}

function ScopeButton(props: {
  readonly title: string;
  readonly label: string;
  readonly actions: ReadonlyArray<{
    readonly id: string;
    readonly title: string;
    readonly image?: string;
    readonly state: "on" | "off";
  }>;
  readonly onSelect: (id: string) => void;
  readonly children: ReactElement;
}) {
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
      <View className="size-9 items-center justify-center">{props.children}</View>
    </Menu>
  );
}
