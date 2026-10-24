/**
 * A setting in Aski's reply, as its live control (stemcells/tasks/aski-forward.md,
 * Move 2, slice E): Aski links it as
 * `[title](t3-context://v1/stemcells-setting/<id>)`, a link upstream's
 * markdown keeps, and the reply draws the setting's switch there. Upstream's
 * switches write through upstream's scope, every connected environment as
 * Settings does by default; ours write where Settings › Aski does.
 */
import type { ReactNode } from "react";

import { KINDS, setTaking, useAutonomy, type Kind } from "../autonomy/autonomy";
import {
  ScopedSwitch,
  SettingsScopeProvider,
  searchableSetting,
  Switch,
  useScopedSettings,
  useUpdateScopedSettings,
} from "../upstream/settings";
import { setSuggestionsOn, useSuggestionsOn } from "../suggestions/switch";
import { setAskiPlans, useAskiPlans } from "./planning";

import "./settingLinks.css";

/** The context link's kind for a setting: `t3-context://v1/<kind>/<id>`. */
export const SETTING_LINK_KIND = "stemcells-setting";

/** What Aski takes for the person, by the id Aski links each with. */
export const TAKES_SWITCHES: Readonly<Record<string, Kind>> = {
  "takes-retry": "retry",
  "takes-go-ahead": "goAhead",
  "takes-implement": "implement",
};

const takes = (kind: Kind) => ({
  title: KINDS[kind].title,
  set: (on: boolean) => void setTaking(kind, on),
});

/** Our switches, by the id Aski links them with. */
export const ASKI_SWITCHES = {
  "aski-plans": { title: "Aski divides the work", set: setAskiPlans },
  suggestions: { title: "Suggest what to say next", set: setSuggestionsOn },
  "takes-retry": takes("retry"),
  "takes-go-ahead": takes("goAhead"),
  "takes-implement": takes("implement"),
} as const;

/** Upstream's switches, by the id Aski links them with, each with its server setting. */
const SERVER_SWITCHES = {
  "auto-settle-merged": {
    title: searchableSetting("auto-settle-merged-threads").title,
    key: "sidebarAutoSettleOnMerge",
  },
  "keep-pull-requests": {
    title: "Keep threads with a PR",
    key: "sidebarAutoSettleKeepPullRequests",
  },
  "auto-resume-limited": {
    title: searchableSetting("auto-resume-limited-threads").title,
    key: "autoResumeLimitedThreads",
  },
  "snooze-limited": {
    title: searchableSetting("snooze-limited-threads").title,
    key: "snoozeLimitedThreads",
  },
} as const;

type AskiId = keyof typeof ASKI_SWITCHES;
type ServerId = keyof typeof SERVER_SWITCHES;

/** Every id Aski may link, with its title. */
export const SETTING_LINKS: ReadonlyMap<string, string> = new Map(
  [...Object.entries(ASKI_SWITCHES), ...Object.entries(SERVER_SWITCHES)].map(([id, { title }]) => [
    id,
    title,
  ]),
);

/** Settings' "all" scope: what the page writes to when it is opened plainly. */
const ALL = {};
const stay = () => {};

/** A context link as the reply's markdown hands it over. */
export interface ContextLink {
  readonly kind: string;
  readonly contextId: string;
  readonly label: string;
}

/** A context link in a reply: a setting's switch when it names one, else its words, as upstream draws them. */
export function renderContextLink(link: ContextLink): ReactNode {
  const id = link.kind === SETTING_LINK_KIND ? link.contextId : null;
  if (id !== null && Object.hasOwn(ASKI_SWITCHES, id))
    return <AskiSwitch id={id as AskiId} label={link.label} />;
  if (id !== null && Object.hasOwn(SERVER_SWITCHES, id))
    return <ServerSwitch id={id as ServerId} label={link.label} />;
  return <span>{link.label}</span>;
}

function AskiSwitch(props: { id: AskiId; label: string }) {
  const { title, set } = ASKI_SWITCHES[props.id];
  // Each hook by its name: the compiler keeps a call to a hook it can't name.
  const plans = useAskiPlans();
  const suggestions = useSuggestionsOn();
  const autonomy = useAutonomy();
  const kind = TAKES_SWITCHES[props.id];
  const on =
    kind !== undefined
      ? (autonomy?.granted.includes(kind) ?? false)
      : props.id === "aski-plans"
        ? plans
        : suggestions;
  return (
    <span data-stemcells-setting="">
      {props.label}
      <Switch
        checked={on}
        disabled={kind !== undefined && autonomy === null}
        aria-label={title}
        onCheckedChange={(checked) => set(checked)}
      />
    </span>
  );
}

function ServerSwitch(props: { id: ServerId; label: string }) {
  return (
    <SettingsScopeProvider search={ALL} onChange={stay}>
      <span data-stemcells-setting="">
        {props.label}
        <ScopedServerSwitch id={props.id} />
      </span>
    </SettingsScopeProvider>
  );
}

function ScopedServerSwitch(props: { id: ServerId }) {
  const { title, key } = SERVER_SWITCHES[props.id];
  const on = useScopedSettings((settings) => settings[key]);
  const update = useUpdateScopedSettings();
  return (
    <ScopedSwitch
      settingKeys={[key]}
      checked={on}
      aria-label={title}
      onCheckedChange={(checked) => update({ [key]: Boolean(checked) })}
    />
  );
}
