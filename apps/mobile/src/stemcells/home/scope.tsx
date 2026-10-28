// The home's scope in its header's top right, where T3 had chips over the list: the project,
// and with two machines or more, the machine. Unchosen, a button shows a plain glyph; chosen, the
// project's own icon or the machine's own symbol, tinted. T3's workspace toolbar hands its
// trailing items here at its seam (`features/workspace/WorkspaceToolbar.ios.tsx`).

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

const ALL = "all";

export function useHomeScopeItems(): ReactElement[] {
  const projects = useProjects();
  const { savedConnectionsById } = useSavedRemoteConnections();
  const kinds = useMachineKinds();
  const machines = Object.values(savedConnectionsById)
    .map((connection) => ({
      id: connection.environmentId,
      label: connection.environmentLabel,
      kind: kinds.get(connection.environmentId),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const { options, setSelectedEnvironmentId, setSelectedProjectKey } = useHomeListOptions(
    new Set(machines.map((machine) => machine.id)),
  );
  const scopes = buildHomeProjectScopes({
    projects,
    environmentId: options.selectedEnvironmentId,
    projectGroupingMode: options.projectGroupingMode,
  });
  const chosen = scopes.find((scope) => scope.key === options.selectedProjectKey);
  const project = chosen?.representative;

  const items = [
    <Toolbar.Custom key="project">
      <ScopeButton
        title="Projects"
        label={chosen ? `Project: ${chosen.title}` : "All projects"}
        actions={[
          { id: ALL, title: "All projects", state: chosen ? "off" : "on" },
          ...scopes.map((scope) => ({
            id: scope.key,
            title: scope.title,
            state: scope === chosen ? ("on" as const) : ("off" as const),
          })),
        ]}
        onSelect={(id) => setSelectedProjectKey(id === ALL ? null : id)}
      >
        {chosen && project ? (
          <ProjectFavicon
            environmentId={project.environmentId}
            faviconPath={project.faviconPath}
            projectIcon={project.projectIcon}
            projectTitle={chosen.title}
            workspaceRoot={project.workspaceRoot}
            size={20}
          />
        ) : (
          <SymbolView name="folder" size={18} tintColorClassName="accent-icon" />
        )}
      </ScopeButton>
    </Toolbar.Custom>,
  ];
  if (machines.length < 2) return items;
  const machine = machines.find((option) => option.id === options.selectedEnvironmentId);
  items.push(
    <Toolbar.Custom key="machine">
      <ScopeButton
        title="Machines"
        label={machine ? `Machine: ${machine.label}` : "All machines"}
        actions={[
          { id: ALL, title: "All machines", state: machine ? "off" : "on" },
          ...machines.map((option) => ({
            id: option.id,
            title: option.label,
            image: ENVIRONMENT_MACHINE_SYMBOLS[option.kind ?? "desktop"],
            state: option.id === machine?.id ? ("on" as const) : ("off" as const),
          })),
        ]}
        onSelect={(id) =>
          setSelectedEnvironmentId(machines.find((option) => option.id === id)?.id ?? null)
        }
      >
        <SymbolView
          name={ENVIRONMENT_MACHINE_SYMBOLS[machine?.kind ?? "desktop"]}
          size={18}
          tintColorClassName={machine ? "accent-primary" : "accent-icon"}
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
      actions={[...props.actions]}
      onPressAction={({ nativeEvent }) => props.onSelect(nativeEvent.event)}
      accessibilityLabel={props.label}
      accessibilityRole="button"
    >
      <View className="size-9 items-center justify-center">{props.children}</View>
    </Menu>
  );
}
