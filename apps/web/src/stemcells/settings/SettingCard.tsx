// A `setting` fence in a reply, as a card of live settings (stemcells/tasks/settings-in-chat.md).
// Each row is upstream's SettingsRow with the control Settings gives it, reading and writing
// where Settings does. A suggested value waits for the person's Apply; a change made here can
// be undone. A setting with no control here, or a page, opens in Settings.
import { useState, type ReactNode } from "react";

import {
  BINDINGS,
  controlOf,
  optionLabel,
  rowStatus,
  YOURS,
  type Binding,
  type Control,
} from "../../../../../stemcells/settings/controls.ts";
import { readSettingFence, type FenceLine } from "../../../../../stemcells/settings/fence.ts";
import {
  crumbsFor,
  placeKey,
  type SettingsPlace,
} from "../../../../../stemcells/settings/places.ts";
import { setTaking, useAutonomy, type Kind } from "../autonomy/autonomy";
import { setAskiPlans, useAskiPlans } from "../aski/planning";
import { setAskiTabOn, useAskiTabOn } from "../aski/tabSwitch";
import {
  ScopedSwitch,
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
  setAppearanceMode,
  settingAst,
  SettingsRow,
  SettingsScopeProvider,
  Switch,
  type ServerSettings,
  Toggle,
  ToggleGroup,
  updateClientSettings,
  useClientSettings,
  useScopedSettings,
  useTheme,
  useUpdateScopedSettings,
} from "../upstream/settings";
import { Button } from "../upstream/ui";
import { PlaceLink } from "./PlaceLink";
import { ProviderRow } from "./ProviderRow";

import "./settingCard.css";

/** Settings' "all" scope: what the page writes to when it is opened plainly. */
const ALL = {};
const stay = () => {};

export function SettingCard(props: {
  readonly source: string;
  readonly environmentId?: string | undefined;
}) {
  const lines = readSettingFence(props.source) ?? [];
  const pages = new Set(lines.flatMap((line) => ("place" in line ? [line.place.page] : [])));
  const page = pages.size === 1 ? [...pages][0]! : null;
  return (
    <SettingsScopeProvider search={ALL} onChange={stay}>
      <section
        data-stemcells-setting-card=""
        aria-label="Settings"
        data-markdown-copy={`\`\`\`setting\n${props.source}\n\`\`\`\n\n`}
      >
        <header data-setting-card-head="">
          {page === null ? (
            <span>Settings</span>
          ) : (
            <PlaceLink
              placeKey={placeKey({ kind: "page", page })}
              label={crumbsFor({ kind: "page", page }).join(" › ")}
              environmentId={props.environmentId}
            />
          )}
        </header>
        {lines.map((line, index) => (
          // oxlint-disable-next-line react/no-array-index-key -- A fence's lines, in order.
          <Line key={index} line={line} environmentId={props.environmentId} />
        ))}
      </section>
    </SettingsScopeProvider>
  );
}

function Line(props: { readonly line: FenceLine; readonly environmentId?: string | undefined }) {
  const { line } = props;
  if ("words" in line) return <p data-setting-card-words="">{line.words}</p>;
  const title = crumbsFor(line.place).at(-1)!;
  if (line.place.kind === "provider" && props.environmentId !== undefined)
    return <ProviderRow place={line.place} title={title} environmentId={props.environmentId} />;
  const binding = line.place.kind === "row" ? BINDINGS[line.place.id] : undefined;
  const control = binding === undefined ? null : controlFor(binding);
  if (binding === undefined || control === null)
    return <OpenRow place={line.place} title={title} environmentId={props.environmentId} />;
  const row = { title, control, binding, suggested: line.suggested };
  if (binding.store === "server") return <ServerRow {...row} />;
  if (binding.store === "client") return <ClientRow {...row} />;
  return <OursRow {...row} />;
}

const OUR_CONTROLS: Readonly<Record<string, Control>> = {
  appearanceMode: { kind: "choice", options: ["system", "light", "dark"] },
};

function controlFor(binding: Binding): Control | null {
  if (binding.store === "ours") return OUR_CONTROLS[binding.key] ?? { kind: "switch" };
  const ast = settingAst(binding.store, binding.key);
  return ast === null ? null : controlOf(ast);
}

function OpenRow(props: {
  readonly place: SettingsPlace;
  readonly title: string;
  readonly environmentId?: string | undefined;
}) {
  return (
    <SettingsRow
      title={props.title}
      control={
        <PlaceLink
          placeKey={placeKey(props.place)}
          label={props.title}
          environmentId={props.environmentId}
        >
          Open in Settings
        </PlaceLink>
      }
    />
  );
}

interface RowProps {
  readonly title: string;
  readonly control: Control;
  readonly binding: Binding;
  readonly suggested: string | undefined;
}

type Value = boolean | string | null;

function ServerRow(props: RowProps) {
  const key = props.binding.key as keyof ServerSettings;
  const value = useScopedSettings((settings) => settings[key]) as Value;
  const update = useUpdateScopedSettings();
  return (
    <CardRow
      {...props}
      value={value}
      set={(next) => update({ [key]: next } as Parameters<typeof update>[0])}
      server
    />
  );
}

function ClientRow(props: RowProps) {
  const key = props.binding.key;
  const value = useClientSettings(
    (settings) => (settings as Record<string, unknown>)[key],
  ) as Value;
  return (
    <CardRow
      {...props}
      value={value}
      set={(next) =>
        void updateClientSettings({ [key]: next } as Parameters<typeof updateClientSettings>[0])
      }
    />
  );
}

const TAKES: Readonly<Record<string, Kind>> = {
  takesRetry: "retry",
  takesGoAhead: "goAhead",
  takesImplement: "implement",
};

function OursRow(props: RowProps) {
  const { key } = props.binding;
  if (key === "appearanceMode") return <AppearanceRow {...props} />;
  if (key === "askiTab" || key === "askiPlans") return <OurSwitch {...props} which={key} />;
  const kind = TAKES[key];
  return kind === undefined ? null : <TakesRow {...props} kind={kind} />;
}

function AppearanceRow(props: RowProps) {
  const { appearanceMode } = useTheme();
  return (
    <CardRow
      {...props}
      value={appearanceMode}
      set={(next) => {
        if (next === "system" || next === "light" || next === "dark") setAppearanceMode(next);
      }}
    />
  );
}

const OUR_SWITCHES = {
  askiTab: setAskiTabOn,
  askiPlans: setAskiPlans,
} as const;

function OurSwitch(props: RowProps & { readonly which: keyof typeof OUR_SWITCHES }) {
  // Each hook by its name: the compiler keeps a call to a hook it can't name.
  const tab = useAskiTabOn();
  const plans = useAskiPlans();
  const value = { askiTab: tab, askiPlans: plans }[props.which];
  const set = OUR_SWITCHES[props.which];
  return <CardRow {...props} value={value} set={(next) => void set(next === true)} />;
}

function TakesRow(props: RowProps & { readonly kind: Kind }) {
  const autonomy = useAutonomy();
  return (
    <CardRow
      {...props}
      value={autonomy?.granted.includes(props.kind) ?? false}
      set={(next) => void setTaking(props.kind, next === true)}
      disabled={autonomy === null}
    />
  );
}

function CardRow(
  props: RowProps & {
    readonly value: Value;
    readonly set: (next: Value) => unknown;
    readonly server?: true;
    readonly disabled?: boolean;
  },
) {
  const { control, value, title } = props;
  // What the row was before this card changed it: Undo puts it back.
  const [before, setBefore] = useState<{ readonly value: Value } | null>(null);
  const change = (next: Value) => {
    if (next === value) return;
    setBefore((held) => held ?? { value });
    props.set(next);
  };
  const status = rowStatus(control, props.binding, value, props.suggested, before !== null);
  let words: ReactNode = null;
  if (status?.kind === "changed")
    words = (
      <>
        Changed here.{" "}
        <Button
          variant="link"
          size="xs"
          onClick={() => {
            if (before !== null) props.set(before.value);
            setBefore(null);
          }}
        >
          Undo
        </Button>
      </>
    );
  else if (status?.kind === "suggested")
    words = (
      <>
        Suggested: {status.from} → <strong>{status.to}</strong>{" "}
        <Button size="xs" onClick={() => change(status.want)} disabled={props.disabled}>
          Apply
        </Button>
      </>
    );
  else if (status?.kind === "already") words = status.words;
  else if (status?.kind === "yours") words = YOURS;
  const settingKeys = props.server ? [props.binding.key as keyof ServerSettings] : [];
  return (
    <SettingsRow
      title={title}
      description={words === null ? undefined : <span data-setting-card-status="">{words}</span>}
      serverScoped={props.server === true}
      settingKeys={settingKeys}
      devicePreference={props.binding.store === "client"}
      control={
        control.kind === "switch" ? (
          props.server ? (
            <ScopedSwitch
              settingKeys={settingKeys}
              checked={value === true}
              aria-label={title}
              onCheckedChange={(checked) => change(Boolean(checked))}
            />
          ) : (
            <Switch
              checked={value === true}
              disabled={props.disabled}
              aria-label={title}
              onCheckedChange={(checked) => change(Boolean(checked))}
            />
          )
        ) : (
          <Choice title={title} options={control.options} value={value} change={change} />
        )
      }
    />
  );
}

function Choice(props: {
  readonly title: string;
  readonly options: ReadonlyArray<string>;
  readonly value: Value;
  readonly change: (next: string) => void;
}) {
  const current = typeof props.value === "string" ? props.value : null;
  if (props.options.length <= 3)
    return (
      <ToggleGroup
        aria-label={props.title}
        value={current === null ? [] : [current]}
        onValueChange={(next) => {
          const picked = props.options.find((option) => option === next[0]);
          if (picked !== undefined) props.change(picked);
        }}
      >
        {props.options.map((option) => (
          <Toggle key={option} value={option}>
            {optionLabel(option)}
          </Toggle>
        ))}
      </ToggleGroup>
    );
  return (
    <Select
      value={current}
      onValueChange={(next) => {
        const picked = props.options.find((option) => option === next);
        if (picked !== undefined) props.change(picked);
      }}
    >
      <SelectTrigger size="sm" aria-label={props.title}>
        <SelectValue>
          {(picked: string | null) => (picked === null ? "Default" : optionLabel(picked))}
        </SelectValue>
      </SelectTrigger>
      <SelectPopup align="end" alignItemWithTrigger={false}>
        {props.options.map((option) => (
          <SelectItem key={option} hideIndicator value={option}>
            {optionLabel(option)}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}
