// The pick's Model section (`stemcells/tasks/model-pick.md`): one line per agent, its mark in the
// gutter and its models by family as one track, everything on screen at once; the effort column
// and footer T3 hands the picker stack under it as the Effort and Access sections. It takes T3's
// model list's place and props, so the trigger, popup, keyboard shortcuts and model writes stay T3's.
import { useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { useMessages } from "gt-react";
import { SearchIcon } from "lucide-react";
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  use,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  ANTIGRAVITY_DEFAULT_MODEL,
  compareSemverVersions,
  type EnvironmentId,
  getDisplayModelName,
  getProviderStatusMessage,
  hasProviderSetup,
  hasRuntimeModelCatalog,
  InlineButton,
  isCommandPaletteOpen,
  isProviderInstancePickerReady,
  isProviderInstancePickerVisible,
  type ModelEsque,
  modelPickerJumpIndexFromCommand,
  primaryServerKeybindingsAtom,
  type ProviderDriverKind,
  ProviderInstanceIcon,
  type ProviderInstanceEntry,
  type ProviderInstanceId,
  rankModelPickerSearch,
  registerModelPickerContent,
  resolveModelPickerSelectedModel,
  resolveSelectableModel,
  type ResolvedKeybindingsConfig,
  resolveShortcutCommand,
  SharedTooltipTrigger,
  shouldShowInstanceBadge,
  Toggle,
  ToggleGroup,
  useProviderWorkspaceSnapshotRefresh,
} from "../upstream/modelPick";
import { cn } from "../upstream/ui";
import { everyVersion, lineup, type LineupEntry, selectedIn } from "./lineup";
import { conciseModelName } from "./names";
import { PickSection } from "./PickSection";
import { PickLevels, PickSlots } from "./pickSlots";

/** T3's model list's props (`ModelPickerContent`), which the pick takes in its place. */
export interface PickLineupProps {
  readonly environmentId: EnvironmentId | null;
  readonly workspaceCwd?: string | null;
  readonly activeInstanceId: ProviderInstanceId;
  readonly model: string;
  readonly selectedModels?: ReadonlyArray<{ instanceId: ProviderInstanceId; model: string }>;
  readonly onToggleModel?: (instanceId: ProviderInstanceId, model: string) => void;
  readonly lockedProvider: ProviderDriverKind | null;
  readonly lockedContinuationGroupKey?: string | null;
  readonly instanceEntries: ReadonlyArray<ProviderInstanceEntry>;
  readonly keybindings?: ResolvedKeybindingsConfig;
  readonly modelOptionsByInstance: ReadonlyMap<ProviderInstanceId, ReadonlyArray<ModelEsque>>;
  readonly terminalOpen?: boolean;
  readonly onRequestClose?: () => void;
  readonly onOpenProviderSetup?: (instanceId: ProviderInstanceId) => void;
  readonly getModelDisabledReason?: (
    instanceId: ProviderInstanceId,
    model: string,
  ) => string | null;
  readonly onInstanceModelChange: (instanceId: ProviderInstanceId, model: string) => void;
  readonly searchInputRef: RefObject<HTMLInputElement | null>;
  readonly docked?: boolean;
  readonly onFocusEffort?: () => void;
  readonly listFooter?: ReactNode;
}

interface Line {
  readonly key: string;
  readonly entry: ProviderInstanceEntry;
  /** A backend the agent runs models on (fx's), named before them; null for the agent's own. */
  readonly backend: {
    readonly name: string;
    readonly unavailableReason?: string | undefined;
  } | null;
  readonly chips: readonly LineupEntry<ModelEsque>[];
  /** Why the whole line can't be picked (another agent's thread); null when it can. */
  readonly locked: string | null;
  readonly needsSetup: boolean;
  readonly badge: boolean;
  /** Under the agent's own track: the version its newest models need. */
  readonly update: string | null;
}

/** A segment of an agent's track, drawn as T3's segmented toggles are, so every row reads alike. */
const SEGMENT =
  "relative flex h-6 min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground outline-none transition-colors hover:bg-background/55 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-xs/10 dark:hover:bg-input/32 dark:aria-pressed:bg-input/72";
const TRACK = "flex min-w-0 flex-1 gap-0.5 rounded-lg bg-input/40 p-0.5";

const pickKey = (instanceId: ProviderInstanceId, slug: string) => `${instanceId}\u0000${slug}`;

/** A level's toggle value; the family's own model is level "", which a toggle can't carry. */
const toggleValue = (level: string) => level || "default";

export function PickLineup(props: PickLineupProps) {
  const { searchInputRef } = props;
  const messages = useMessages();
  const navigate = useNavigate();
  const slots = use(PickSlots);
  const serverKeybindings = useAtomValue(primaryServerKeybindingsAtom);
  const [query, setQuery] = useState("");
  const linesRef = useRef<HTMLDivElement>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- tells T3's global shortcuts the picker is open, as its list does
  useLayoutEffect(() => registerModelPickerContent(), []);
  useProviderWorkspaceSnapshotRefresh({
    environmentId: props.environmentId,
    gitCwd: props.workspaceCwd ?? null,
    instanceId: props.activeInstanceId,
  });

  const resolve = (instanceId: ProviderInstanceId, model: string) => {
    const entry = props.instanceEntries.find((candidate) => candidate.instanceId === instanceId);
    return (
      resolveModelPickerSelectedModel({
        driverKind: entry?.driverKind,
        model,
        options: props.modelOptionsByInstance.get(instanceId) ?? [],
      })?.slug ?? model
    );
  };
  // Every pick lights, several when a send goes to several models.
  const picks = (
    props.selectedModels ?? [{ instanceId: props.activeInstanceId, model: props.model }]
  ).map((pick) => ({ instanceId: pick.instanceId, slug: resolve(pick.instanceId, pick.model) }));
  const picked = new Set(picks.map((pick) => pickKey(pick.instanceId, pick.slug)));
  const activeSlug = resolve(props.activeInstanceId, props.model);
  const searching = query.trim().length > 0;
  const matchesLock = (entry: ProviderInstanceEntry) =>
    props.lockedProvider === null ||
    (entry.driverKind === props.lockedProvider &&
      (!props.lockedContinuationGroupKey ||
        entry.continuationGroupKey === props.lockedContinuationGroupKey));
  const offered = (entry: ProviderInstanceEntry, option: ModelEsque) => {
    if (entry.driverKind === "antigravity" && option.slug === ANTIGRAVITY_DEFAULT_MODEL)
      return false;
    if (isProviderInstancePickerReady(entry)) return true;
    // A thread's own model stays visible while its agent recovers, as T3's list keeps it.
    return (
      entry.enabled &&
      hasRuntimeModelCatalog(entry.driverKind) &&
      entry.instanceId === props.activeInstanceId &&
      option.slug === activeSlug &&
      option.isUnavailable === true
    );
  };
  const visible = props.instanceEntries.filter(isProviderInstancePickerVisible);
  // Named as a person reads them, a backend's prefix dropped ("Anthropic: Claude Opus 5.5").
  const modelsOf = (entry: ProviderInstanceEntry) =>
    (props.modelOptionsByInstance.get(entry.instanceId) ?? [])
      .filter((option) => offered(entry, option))
      .map((option) => ({ ...option, name: getDisplayModelName(option) }));

  // A search ranks every model, older ones too, and lights each family-and-version it hits.
  const hits = searching
    ? rankModelPickerSearch(
        visible.flatMap((entry) => modelsOf(entry).map((model) => ({ entry, model }))),
        query,
        ({ entry, model }) => ({
          name: model.name,
          slug: model.slug,
          shortName: conciseModelName(model.name),
          ...(model.subProvider ? { subProvider: model.subProvider } : {}),
          driverKind: entry.driverKind,
          providerDisplayName: entry.displayName,
        }),
      )
    : [];
  const hitRank = new Map(
    hits.map((hit, rank) => [pickKey(hit.entry.instanceId, hit.model.slug), rank]),
  );
  const rankOf = (entry: ProviderInstanceEntry, chip: LineupEntry<ModelEsque>) =>
    Math.min(
      ...chip.models.map(
        (model) => hitRank.get(pickKey(entry.instanceId, model.slug)) ?? Number.POSITIVE_INFINITY,
      ),
    );

  const lines: Line[] = visible.flatMap((entry): Line[] => {
    const options = props.modelOptionsByInstance.get(entry.instanceId) ?? [];
    const models = modelsOf(entry);
    const slugs = picks.filter((pick) => pick.instanceId === entry.instanceId).map((p) => p.slug);
    const needsSetup =
      !searching &&
      props.onOpenProviderSetup !== undefined &&
      entry.enabled &&
      entry.status !== "disabled" &&
      hasProviderSetup(entry.snapshot) &&
      (!isProviderInstancePickerReady(entry) ||
        !entry.installed ||
        entry.snapshot.auth.status === "unauthenticated" ||
        !options.some((option) => !option.isUnavailable));
    const locked = matchesLock(entry)
      ? null
      : `${entry.displayName} is unavailable in this Cell. Start a new Cell to switch agents.`;
    const badge = shouldShowInstanceBadge(entry, props.instanceEntries);
    // An agent that runs models on several backends lines each up apart, as T3's list headed them.
    const backends = entry.snapshot.subProviders ?? [];
    const named = new Set(backends.map((backend) => backend.name));
    const groups = [
      {
        backend: null,
        models: models.filter((model) => !model.subProvider || !named.has(model.subProvider)),
      },
      ...backends.map((backend) => ({
        backend,
        models: models.filter((model) => model.subProvider === backend.name),
      })),
    ];
    return groups.flatMap((group, index): Line[] => {
      const chips = searching
        ? everyVersion(group.models, slugs)
            .filter((chip) => Number.isFinite(rankOf(entry, chip)))
            .sort((a, b) => rankOf(entry, a) - rankOf(entry, b))
        : lineup(group.models, slugs);
      const setupHere = needsSetup && index === 0;
      const reasonOnly = group.backend?.unavailableReason !== undefined && !searching;
      if (chips.length === 0 && !setupHere && !reasonOnly) return [];
      return [
        {
          key: `${entry.instanceId}\u0000${group.backend?.name ?? ""}`,
          entry,
          backend: group.backend,
          chips,
          locked,
          needsSetup: setupHere,
          badge,
          update:
            index === 0 && !searching ? updateNote(entry.snapshot.updateRequiredModels) : null,
        },
      ];
    });
  });
  if (searching) {
    const best = (line: Line) => Math.min(...line.chips.map((chip) => rankOf(line.entry, chip)));
    lines.sort((a, b) => best(a) - best(b));
  }

  const pick = (instanceId: ProviderInstanceId, slug: string, additive: boolean) => {
    if (props.getModelDisabledReason?.(instanceId, slug)) return;
    const entry = props.instanceEntries.find((candidate) => candidate.instanceId === instanceId);
    const options = props.modelOptionsByInstance.get(instanceId);
    if (!entry || !options) return;
    const resolved = resolveSelectableModel(entry.driverKind, slug, options);
    if (!resolved) return;
    if (additive && props.onToggleModel) props.onToggleModel(instanceId, resolved);
    else props.onInstanceModelChange(instanceId, resolved);
  };

  const chipsIn = (root: Element | null | undefined) => [
    ...(root?.querySelectorAll<HTMLButtonElement>("[data-pick-model]:not(:disabled)") ?? []),
  ];
  const focusChip = (chip: HTMLButtonElement | undefined) => {
    chip?.focus({ preventScroll: true });
    chip?.scrollIntoView({ block: "nearest" });
  };
  const litOrFirst = (root: Element | null | undefined) => {
    const all = chipsIn(root);
    return all.find((chip) => chip.getAttribute("aria-pressed") === "true") ?? all[0];
  };
  const lineElements = () => [...(linesRef.current?.querySelectorAll("[data-pick-line]") ?? [])];
  /** Arrows move among the chips: along a line, or to the nearest chip in the next line. */
  const moveAmongChips = (event: KeyboardEvent<HTMLDivElement>) => {
    const all = chipsIn(linesRef.current);
    const current = all.indexOf(event.target as HTMLButtonElement);
    if (current < 0) return;
    const from = all[current]!;
    let next: HTMLButtonElement | undefined;
    if (event.key === "ArrowLeft") next = all[current - 1];
    else if (event.key === "ArrowRight") next = all[current + 1];
    else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const lines = lineElements();
      const line = from.closest("[data-pick-line]");
      const target = lines[lines.indexOf(line!) + (event.key === "ArrowDown" ? 1 : -1)];
      if (!target) {
        event.preventDefault();
        if (event.key === "ArrowUp") searchInputRef.current?.focus();
        else props.onFocusEffort?.();
        return;
      }
      const x = from.getBoundingClientRect().left;
      next = chipsIn(target)
        .map((chip) => ({ chip, distance: Math.abs(chip.getBoundingClientRect().left - x) }))
        .sort((a, b) => a.distance - b.distance)[0]?.chip;
    } else return;
    event.preventDefault();
    event.stopPropagation();
    focusChip(next);
  };

  // T3's picker shortcuts: the numbers pick the nth model in reading order, and the provider
  // steps move to the next or previous agent's line.
  const onWindowKeyDown = useEffectEvent((event: globalThis.KeyboardEvent) => {
    if (event.defaultPrevented || event.repeat || event.isComposing || event.keyCode === 229) {
      return;
    }
    if (isCommandPaletteOpen()) return;
    const command = resolveShortcutCommand(event, props.keybindings ?? serverKeybindings, {
      platform: navigator.platform,
      context: {
        terminalFocus: false,
        terminalOpen: props.terminalOpen ?? false,
        modelPickerOpen: true,
      },
    });
    if (command === "modelPicker.previousProvider" || command === "modelPicker.nextProvider") {
      event.preventDefault();
      event.stopPropagation();
      const lines = lineElements().filter((line) => chipsIn(line).length > 0);
      if (lines.length === 0) return;
      const focused = document.activeElement?.closest("[data-pick-line]");
      const from = lines.findIndex((line) =>
        focused ? line === focused : line.querySelector('[aria-pressed="true"]'),
      );
      const step = command === "modelPicker.nextProvider" ? 1 : -1;
      focusChip(litOrFirst(lines[(Math.max(from, 0) + step + lines.length) % lines.length]));
      return;
    }
    const index = modelPickerJumpIndexFromCommand(command ?? "");
    if (index === null) return;
    event.preventDefault();
    event.stopPropagation();
    chipsIn(linesRef.current)[index]?.click();
  });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- listens on the window for T3's picker shortcuts while the pick is open, as its list did
  useEffect(() => {
    const listener = (event: globalThis.KeyboardEvent) => onWindowKeyDown(event);
    window.addEventListener("keydown", listener, true);
    return () => window.removeEventListener("keydown", listener, true);
  }, []);

  const activeLine = lines.find(
    (line) =>
      line.entry.instanceId === props.activeInstanceId &&
      line.chips.some((chip) => chip.models.some((model) => model.slug === activeSlug)),
  );
  const active = activeLine ? selectedIn(activeLine.chips, activeSlug) : null;
  // The agent a pick runs stands out; the others' marks wait a step back.
  const running = new Set(picks.map((pick) => pick.instanceId));
  const lit = (line: Line, chip: LineupEntry<ModelEsque>) =>
    chip.models.some((model) => picked.has(pickKey(line.entry.instanceId, model.slug)));
  const tabStop =
    lines.flatMap((line) => line.chips.filter((chip) => lit(line, chip)))[0] ?? lines[0]?.chips[0];

  const levels =
    active && active.entry.levels.length > 0 && activeLine ? (
      <ToggleGroup
        className="w-full"
        aria-label="Effort"
        value={active.level === null ? [] : [toggleValue(active.level)]}
        onValueChange={(value) => {
          const level = active.entry.levels.find(
            (candidate) => toggleValue(candidate.id) === value[0],
          );
          if (level) pick(activeLine.entry.instanceId, level.model.slug, false);
        }}
      >
        {active.entry.levels.map((level) => (
          <Toggle
            key={level.id}
            value={toggleValue(level.id)}
            className="flex-1"
            data-effort-level={level.id === active.level ? "" : undefined}
          >
            {level.label}
          </Toggle>
        ))}
      </ToggleGroup>
    ) : null;

  return (
    <div
      data-model-picker-content="true"
      className={cn(
        "flex w-screen max-w-104 flex-col",
        props.docked && "max-sm:w-full max-sm:max-w-none",
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border/70 px-3">
        <SearchIcon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={searchInputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a model"
          aria-label="Find a model"
          className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/72"
          onKeyDown={(event) => {
            // An input method's Enter commits its text, not a model.
            if (event.nativeEvent.isComposing || event.keyCode === 229) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              focusChip(litOrFirst(linesRef.current));
            } else if (event.key === "Enter" && searching) {
              event.preventDefault();
              chipsIn(linesRef.current)[0]?.click();
            } else if (
              event.key === "ArrowRight" &&
              props.onFocusEffort &&
              event.currentTarget.selectionStart === query.length
            ) {
              event.preventDefault();
              props.onFocusEffort();
            }
          }}
        />
      </div>
      <PickSection title="Model" gutter>
        <div
          ref={linesRef}
          className="flex max-h-72 min-h-0 flex-col gap-1.5 overflow-y-auto overscroll-contain"
          onKeyDown={moveAmongChips}
        >
          {lines.map((line) => (
            <PickLine
              key={line.key}
              line={line}
              quiet={!running.has(line.entry.instanceId)}
              searching={searching}
              lit={(chip) => lit(line, chip)}
              tabStop={tabStop}
              disabledReason={(slug) =>
                line.locked ?? props.getModelDisabledReason?.(line.entry.instanceId, slug) ?? null
              }
              onPick={(slug, event) => pick(line.entry.instanceId, slug, event.shiftKey)}
              onSetup={() => {
                props.onRequestClose?.();
                props.onOpenProviderSetup?.(line.entry.instanceId);
              }}
              onProviderSettings={() => {
                props.onRequestClose?.();
                void navigate({ to: "/settings/providers" });
              }}
              setupMessage={getProviderStatusMessage(line.entry.snapshot, messages)}
            />
          ))}
          {lines.length === 0 ? (
            <p className="ps-7 py-1 text-muted-foreground text-xs">
              {searching ? "No model by that name" : "No agent is ready"}
            </p>
          ) : null}
        </div>
      </PickSection>
      {/* T3's picker hands focus to the picked level here, else to the first switch. */}
      <div data-model-picker-effort className="flex flex-col pb-2.5">
        {/* T3's composer docks the effort column (the pick's Effort section), which takes the levels. */}
        {slots?.effort ? (
          <PickLevels value={levels}>{slots.effort}</PickLevels>
        ) : levels ? (
          <PickSection title="Effort">{levels}</PickSection>
        ) : null}
        {props.listFooter}
        {slots?.footer}
      </div>
    </div>
  );
}

/** "Update to 2.1.321 for its newest models.": under its agent's track, so it names neither. */
function updateNote(models: ReadonlyArray<{ readonly minVersion: string }> | undefined) {
  if (!models?.length) return null;
  const newest = models
    .map((model) => model.minVersion)
    .reduce((highest, version) =>
      compareSemverVersions(version, highest) > 0 ? version : highest,
    );
  return `Update to ${newest} for its newest models.`;
}

/** One agent's line: its mark in the gutter, its families as one track; notes start at the track. */
function PickLine(props: {
  readonly line: Line;
  readonly quiet: boolean;
  readonly searching: boolean;
  readonly lit: (chip: LineupEntry<ModelEsque>) => boolean;
  readonly tabStop: LineupEntry<ModelEsque> | undefined;
  readonly disabledReason: (slug: string) => string | null;
  readonly onPick: (slug: string, event: MouseEvent) => void;
  readonly onSetup: () => void;
  readonly onProviderSettings: () => void;
  readonly setupMessage: string;
}) {
  const { line } = props;
  const note = "ps-7 text-muted-foreground text-xs leading-snug";
  return (
    <div
      data-pick-line
      role="group"
      aria-label={
        line.backend ? `${line.entry.displayName}, ${line.backend.name}` : line.entry.displayName
      }
      className={cn("flex flex-col gap-1", line.locked && "opacity-60")}
    >
      {line.backend ? <span className={note}>{line.backend.name}</span> : null}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex w-5 shrink-0 justify-center transition-opacity",
            props.quiet && "opacity-45",
          )}
        >
          <ProviderInstanceIcon
            driverKind={line.entry.driverKind}
            displayName={line.entry.displayName}
            accentColor={line.entry.accentColor}
            acpRegistryAgentId={line.entry.acpRegistryAgentId}
            acpRegistryIconUrl={line.entry.acpRegistryIconUrl}
            showBadge={line.badge}
            className="size-4"
            iconClassName="size-4"
            indicatorBackground="var(--popover)"
            badgeClassName="right-[-0.125rem] bottom-[-0.125rem] h-3 min-w-3 px-0.5 text-5xs"
          />
        </span>
        {line.chips.length > 0 ? (
          // A search's hits keep their own widths and wrap; a family line shares its track evenly.
          <div className={cn(TRACK, props.searching && "flex-wrap")}>
            {line.chips.map((chip) => {
              const reason = props.disabledReason(chip.model.slug);
              const unavailable = chip.model.isUnavailable === true;
              const button = (
                <button
                  key={chip.key}
                  type="button"
                  data-pick-model
                  aria-pressed={props.lit(chip)}
                  aria-label={`${chip.label}, ${line.entry.displayName}${unavailable ? ", unavailable" : ""}`}
                  tabIndex={chip === props.tabStop ? 0 : -1}
                  disabled={reason !== null}
                  className={cn(
                    SEGMENT,
                    !props.searching && "flex-1",
                    unavailable && "line-through decoration-muted-foreground/60",
                  )}
                  onClick={(event) => props.onPick(chip.model.slug, event)}
                >
                  <span className="truncate">{chip.label}</span>
                  {chip.model.badge === "new" ? (
                    <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-update" />
                  ) : null}
                </button>
              );
              return reason === null ? (
                button
              ) : (
                <SharedTooltipTrigger
                  key={chip.key}
                  render={<span className={cn("flex min-w-0", !props.searching && "flex-1")} />}
                  label={reason}
                >
                  {button}
                </SharedTooltipTrigger>
              );
            })}
          </div>
        ) : (
          <span className="min-h-7 flex-1 content-center text-muted-foreground text-xs">
            {line.backend?.unavailableReason ?? null}
          </span>
        )}
      </div>
      {line.update ? (
        <p className={note}>
          {line.update}{" "}
          <InlineButton onClick={props.onProviderSettings}>Provider settings</InlineButton>
        </p>
      ) : null}
      {line.needsSetup ? (
        <span className={cn(note, "flex items-center gap-2")}>
          <span className="line-clamp-2">{props.setupMessage}</span>
          <InlineButton onClick={props.onSetup}>Set up</InlineButton>
        </span>
      ) : null}
    </div>
  );
}
