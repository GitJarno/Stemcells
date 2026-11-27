// The pick's lines (`stemcells/tasks/model-pick.md`): one per agent, its mark then its models by
// family, everything on screen at once. It takes T3's model list's place and props, so the
// trigger, popup, keyboard shortcuts and model writes stay T3's.
import { useNavigate } from "@tanstack/react-router";
import { useLocale, useMessages } from "gt-react";
import { SearchIcon } from "lucide-react";
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  use,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  ANTIGRAVITY_DEFAULT_MODEL,
  type EnvironmentId,
  formatProviderUpdateRequiredNotice,
  getProviderStatusMessage,
  hasProviderSetup,
  hasRuntimeModelCatalog,
  InlineButton,
  isProviderInstancePickerReady,
  isProviderInstancePickerVisible,
  type ModelEsque,
  type ProviderDriverKind,
  ProviderInstanceIcon,
  type ProviderInstanceEntry,
  type ProviderInstanceId,
  rankModelPickerSearch,
  registerModelPickerContent,
  resolveModelPickerSelectedModel,
  resolveSelectableModel,
  SharedTooltipTrigger,
  shouldShowInstanceBadge,
  Toggle,
  ToggleGroup,
  useProviderWorkspaceSnapshotRefresh,
} from "../upstream/modelPick";
import { cn } from "../upstream/ui";
import { everyVersion, lineup, type LineupEntry, selectedIn } from "./lineup";
import { conciseModelName } from "./names";
import { PickSlots } from "./pickSlots";

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
  readonly modelOptionsByInstance: ReadonlyMap<ProviderInstanceId, ReadonlyArray<ModelEsque>>;
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
  readonly entry: ProviderInstanceEntry;
  readonly chips: readonly LineupEntry<ModelEsque>[];
  /** Why the whole line can't be picked (another agent's thread); null when it can. */
  readonly locked: string | null;
  readonly needsSetup: boolean;
  readonly badge: boolean;
}

const CHIP =
  "relative flex h-7 min-w-0 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground outline-none transition-colors hover:bg-input/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:bg-input/72 aria-pressed:text-foreground";

function selectedSlugs(props: PickLineupProps): ReadonlyMap<ProviderInstanceId, string> {
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
  const picks = props.selectedModels ?? [
    { instanceId: props.activeInstanceId, model: props.model },
  ];
  return new Map(picks.map((pick) => [pick.instanceId, resolve(pick.instanceId, pick.model)]));
}

export function PickLineup(props: PickLineupProps) {
  const { searchInputRef } = props;
  const messages = useMessages();
  const locale = useLocale();
  const navigate = useNavigate();
  const slots = use(PickSlots);
  const [query, setQuery] = useState("");
  const linesRef = useRef<HTMLDivElement>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- tells T3's global shortcuts the picker is open, as its list does
  useLayoutEffect(() => registerModelPickerContent(), []);
  useProviderWorkspaceSnapshotRefresh({
    environmentId: props.environmentId,
    gitCwd: props.workspaceCwd ?? null,
    instanceId: props.activeInstanceId,
  });

  const selected = selectedSlugs(props);
  const activeSlug = selected.get(props.activeInstanceId) ?? "";
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
  const modelsOf = (entry: ProviderInstanceEntry) =>
    (props.modelOptionsByInstance.get(entry.instanceId) ?? []).filter((option) =>
      offered(entry, option),
    );

  // A search ranks every model, older ones too, and lights each family-and-version it hits.
  const hits = searching
    ? rankModelPickerSearch(
        visible.flatMap((entry) => modelsOf(entry).map((model) => ({ entry, model }))),
        query,
        ({ entry, model }) => ({
          name: model.name,
          slug: model.slug,
          shortName: conciseModelName(model.name),
          driverKind: entry.driverKind,
          providerDisplayName: entry.displayName,
        }),
      )
    : [];
  const hitRank = new Map(
    hits.map((hit, rank) => [`${hit.entry.instanceId}\u0000${hit.model.slug}`, rank]),
  );
  const rankOf = (entry: ProviderInstanceEntry, chip: LineupEntry<ModelEsque>) =>
    Math.min(
      ...chip.models.map(
        (model) =>
          hitRank.get(`${entry.instanceId}\u0000${model.slug}`) ?? Number.POSITIVE_INFINITY,
      ),
    );

  const lines: Line[] = visible.flatMap((entry): Line[] => {
    const options = props.modelOptionsByInstance.get(entry.instanceId) ?? [];
    const models = modelsOf(entry);
    const slug = selected.get(entry.instanceId) ?? null;
    const chips = searching
      ? everyVersion(models, slug)
          .filter((chip) => Number.isFinite(rankOf(entry, chip)))
          .sort((a, b) => rankOf(entry, a) - rankOf(entry, b))
      : lineup(models, slug);
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
    if (chips.length === 0 && !needsSetup) return [];
    return [
      {
        entry,
        chips,
        locked: matchesLock(entry)
          ? null
          : `${entry.displayName} is unavailable in this Cell. Start a new Cell to switch agents.`,
        needsSetup,
        badge: shouldShowInstanceBadge(entry, props.instanceEntries),
      },
    ];
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

  const chips = () => [
    ...(linesRef.current?.querySelectorAll<HTMLButtonElement>("[data-pick-model]:not(:disabled)") ??
      []),
  ];
  const focusChip = (chip: HTMLButtonElement | undefined) => {
    chip?.focus({ preventScroll: true });
    chip?.scrollIntoView({ block: "nearest" });
  };
  const focusSelectedChip = () => {
    const all = chips();
    focusChip(all.find((chip) => chip.getAttribute("aria-pressed") === "true") ?? all[0]);
  };
  /** Arrows move among the chips: along a line, or to the nearest chip in the next line. */
  const moveAmongChips = (event: KeyboardEvent<HTMLDivElement>) => {
    const all = chips();
    const current = all.indexOf(event.target as HTMLButtonElement);
    if (current < 0) return;
    const from = all[current]!;
    let next: HTMLButtonElement | undefined;
    if (event.key === "ArrowLeft") next = all[current - 1];
    else if (event.key === "ArrowRight") next = all[current + 1];
    else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const line = from.closest("[data-pick-line]");
      const lines = [...(linesRef.current?.querySelectorAll("[data-pick-line]") ?? [])];
      const target = lines[lines.indexOf(line!) + (event.key === "ArrowDown" ? 1 : -1)];
      if (!target) {
        event.preventDefault();
        if (event.key === "ArrowUp") searchInputRef.current?.focus();
        else props.onFocusEffort?.();
        return;
      }
      const x = from.getBoundingClientRect().left;
      next = [...target.querySelectorAll<HTMLButtonElement>("[data-pick-model]:not(:disabled)")]
        .map((chip) => ({ chip, distance: Math.abs(chip.getBoundingClientRect().left - x) }))
        .sort((a, b) => a.distance - b.distance)[0]?.chip;
    } else return;
    event.preventDefault();
    event.stopPropagation();
    focusChip(next);
  };

  const activeLine = lines.find((line) => line.entry.instanceId === props.activeInstanceId);
  const active = activeLine ? selectedIn(activeLine.chips, activeSlug) : null;
  const notice =
    activeLine && !searching
      ? formatProviderUpdateRequiredNotice(activeLine.entry.snapshot, query, messages, locale)
      : null;
  const tabStop = lines.flatMap((line) => line.chips).find((chip) => chip === active?.entry);

  return (
    <div
      data-model-picker-content="true"
      className={cn(
        "flex w-screen max-w-96 flex-col",
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
              focusSelectedChip();
            } else if (event.key === "Enter" && searching) {
              event.preventDefault();
              chips()[0]?.click();
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
      <div
        ref={linesRef}
        className="flex max-h-72 min-h-0 flex-col gap-1 overflow-y-auto overscroll-contain p-2"
        onKeyDown={moveAmongChips}
      >
        {lines.map((line) => (
          <PickLine
            key={line.entry.instanceId}
            line={line}
            selectedSlug={selected.get(line.entry.instanceId) ?? null}
            tabStop={tabStop}
            disabledReason={(slug) =>
              line.locked ?? props.getModelDisabledReason?.(line.entry.instanceId, slug) ?? null
            }
            onPick={(slug, event) => pick(line.entry.instanceId, slug, event.shiftKey)}
            onSetup={() => {
              props.onRequestClose?.();
              props.onOpenProviderSetup?.(line.entry.instanceId);
            }}
            setupMessage={getProviderStatusMessage(line.entry.snapshot, messages)}
          />
        ))}
        {lines.length === 0 ? (
          <p className="px-1 py-1.5 text-muted-foreground text-sm">
            {searching ? "No model by that name" : "No agent is ready"}
          </p>
        ) : null}
      </div>
      {active && active.entry.levels.length > 0 && activeLine ? (
        <div data-model-picker-effort className="border-t border-border/70 px-3 py-2">
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
                // T3's picker focuses the level marked so, the one picked.
                data-effort-level={level.id === active.level ? "" : undefined}
              >
                {level.label}
              </Toggle>
            ))}
          </ToggleGroup>
        </div>
      ) : null}
      {slots?.effort}
      {props.listFooter}
      {notice ? (
        <p className="border-t border-border/70 px-3 py-2 text-muted-foreground text-xs leading-snug">
          {notice}{" "}
          <InlineButton
            onClick={() => {
              props.onRequestClose?.();
              void navigate({ to: "/settings/providers" });
            }}
          >
            Provider settings
          </InlineButton>
        </p>
      ) : null}
      {slots?.footer}
    </div>
  );
}

/** A level's toggle value; the family's own model is level "", which a toggle can't carry. */
const toggleValue = (level: string) => level || "default";

function PickLine(props: {
  readonly line: Line;
  readonly selectedSlug: string | null;
  readonly tabStop: LineupEntry<ModelEsque> | undefined;
  readonly disabledReason: (slug: string) => string | null;
  readonly onPick: (slug: string, event: MouseEvent) => void;
  readonly onSetup: () => void;
  readonly setupMessage: string;
}) {
  const { line } = props;
  const lit = selectedIn(line.chips, props.selectedSlug)?.entry;
  return (
    <div
      data-pick-line
      role="group"
      aria-label={line.entry.displayName}
      className={cn("flex items-start gap-2 ps-1.5", line.locked && "opacity-60")}
    >
      <span className="flex h-7 shrink-0 items-center">
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
      <div className="flex min-w-0 flex-1 flex-wrap gap-0.5">
        {line.needsSetup && line.chips.length === 0 ? (
          <span className="flex min-h-7 items-center gap-2 text-muted-foreground text-xs">
            <span className="line-clamp-2">{props.setupMessage}</span>
            <InlineButton onClick={props.onSetup}>Set up</InlineButton>
          </span>
        ) : null}
        {line.chips.map((chip) => {
          const reason = props.disabledReason(chip.model.slug);
          const unavailable = chip.model.isUnavailable === true;
          const button = (
            <button
              key={chip.key}
              type="button"
              data-pick-model
              aria-pressed={chip === lit}
              aria-label={`${chip.label}, ${line.entry.displayName}${unavailable ? ", unavailable" : ""}`}
              tabIndex={
                chip === props.tabStop || (!props.tabStop && chip === line.chips[0]) ? 0 : -1
              }
              disabled={reason !== null}
              className={cn(CHIP, unavailable && "line-through decoration-muted-foreground/60")}
              onClick={(event) => props.onPick(chip.model.slug, event)}
            >
              {chip.label}
              {chip.model.badge === "new" ? (
                <span aria-hidden="true" className="size-1.5 rounded-full bg-update" />
              ) : null}
            </button>
          );
          return reason === null ? (
            button
          ) : (
            <SharedTooltipTrigger key={chip.key} render={<span />} label={reason}>
              {button}
            </SharedTooltipTrigger>
          );
        })}
      </div>
    </div>
  );
}
