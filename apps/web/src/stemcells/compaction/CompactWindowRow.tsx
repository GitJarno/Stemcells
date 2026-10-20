import {
  defaultInstanceIdForDriver,
  ProviderDriverKind,
  searchableSetting,
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
  SettingsRow,
} from "../upstream/compaction";
import {
  compactWindowChoices,
  compactWindowIn,
  configWithCompactWindow,
  windowLabel,
} from "./windows";

const CLAUDE = ProviderDriverKind.make("claudeAgent");

/**
 * Where a Claude instance's Cells compact, in its Runtime section: the
 * instance's `autoCompactWindow`, which each Cell takes as it starts. It
 * draws nothing for other providers.
 */
export function CompactWindowRow(props: {
  readonly instanceId: string;
  readonly driver: string;
  readonly config: unknown;
  readonly onChange: (nextConfig: Record<string, unknown> | undefined) => void;
}) {
  if (props.driver !== CLAUDE) return null;
  const current = compactWindowIn(props.config);
  const choices = compactWindowChoices(current);
  const search = searchableSetting("cell-compact-window");
  // One row is the search's anchor: the default Claude's, when there are several.
  const id =
    props.instanceId === defaultInstanceIdForDriver(CLAUDE)
      ? search.id
      : `provider-instance-${props.instanceId}-compact-window`;
  const selectId = `${id}-select`;
  return (
    <SettingsRow
      id={id}
      title={<label htmlFor={selectId}>{search.title}</label>}
      description="Each Claude Cell compacts its context here. A model with less context compacts when it fills. Running Cells take a change when they next start."
      control={
        <Select
          value={current}
          onValueChange={(next) => {
            if (typeof next !== "string" || next === current) return;
            props.onChange(configWithCompactWindow(props.config, next));
          }}
        >
          <SelectTrigger
            id={selectId}
            size="sm"
            className="w-full max-w-full @min-[32rem]/settings-row:w-56"
            aria-label={search.title}
          >
            <SelectValue>{windowLabel(current)}</SelectValue>
          </SelectTrigger>
          <SelectPopup align="start" alignItemWithTrigger={false}>
            {choices.map((choice) => (
              <SelectItem key={choice.value} value={choice.value}>
                {choice.label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      }
    />
  );
}
