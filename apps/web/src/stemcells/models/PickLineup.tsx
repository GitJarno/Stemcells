// The pick's lines (`stemcells/tasks/model-pick.md`): one per agent, its mark then its models by
// family, everything on screen at once. It takes T3's model list's place and props, so the
// trigger, popup, keyboard shortcuts and model writes stay T3's.
import { useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { useLocale, useMessages } from "gt-react";
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
  type EnvironmentId,
  formatProviderUpdateRequiredNotice,
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
}

const CHIP =
  "relative flex h-7 min-w-0 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground outline-none transition-colors hover:bg-input/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:bg-input/72 aria-pressed:text-foreground";

const pickKey = (instanceId: ProviderInstanceId, slug: string) => `${instanceId}\u0000${slug}`;

/** A level's toggle value; the family's own model is level "", which a toggle can't carry. */
const toggleValue = (level: string) => level || "default";

export function PickLineup(props: PickLineupProps) {
  const { searchInputRef } = props;
  const messages = useMessages();
  const locale = useLocale();
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
  const activeEntry = props.instanceEntries.find(
    (entry) => entry.instanceId === props.activeInstanceId,
  );
  const notice =
    activeEntry && !searching
      ? formatProviderUpdateRequiredNotice(activeEntry.snapshot, query, messages, locale)
      : null;
  const lit = (line: Line, chip: LineupEntry<ModelEsque>) =>
    chip.models.some((model) => picked.has(pickKey(line.entry.instanceId, model.slug)));
  const tabStop =
    lines.flatMap((line) => line.chips.filter((chip) => lit(line, chip)))[0] ?? lines[0]?.chips[0];

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
      <div
        ref={linesRef}
        className="flex max-h-72 min-h-0 flex-col gap-1 overflow-y-auto overscroll-contain p-2"
        onKeyDown={moveAmongChips}
      >
        {lines.map((line) => (
          <PickLine
            key={line.key}
            line={line}
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
            setupMessage={getProviderStatusMessage(line.entry.snapshot, messages)}
          />
        ))}
        {lines.length === 0 ? (
          <p className="px-1 py-1.5 text-muted-foreground text-sm">
            {searching ? "No model by that name" : "No agent is ready"}
          </p>
        ) : null}
      </div>
      {/* T3's picker hands focus to the picked level here, else to the first switch. */}
      <div data-model-picker-effort className="flex flex-col">
        {active && active.entry.levels.length > 0 && activeLine ? (
          <div className="border-t border-border/70 px-3 py-2">
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
    </div>
  );
}

function PickLine(props: {
  readonly line: Line;
  readonly lit: (chip: LineupEntry<ModelEsque>) => boolean;
  readonly tabStop: LineupEntry<ModelEsque> | undefined;
  readonly disabledReason: (slug: string) => string | null;
  readonly onPick: (slug: string, event: MouseEvent) => void;
  readonly onSetup: () => void;
  readonly setupMessage: string;
}) {
  const { line } = props;
  return (
    <div
      data-pick-line
      role="group"
      aria-label={
        line.backend ? `${line.entry.displayName}, ${line.backend.name}` : line.entry.displayName
      }
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
        {line.backend ? (
          <span className="flex h-7 items-center pe-1 text-muted-foreground/72 text-xs">
            {line.backend.name}
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
              aria-pressed={props.lit(chip)}
              aria-label={`${chip.label}, ${line.entry.displayName}${unavailable ? ", unavailable" : ""}`}
              tabIndex={chip === props.tabStop ? 0 : -1}
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
        {line.backend?.unavailableReason && line.chips.length === 0 ? (
          <span className="flex min-h-7 items-center text-muted-foreground text-xs">
            {line.backend.unavailableReason}
          </span>
        ) : null}
        {line.needsSetup ? (
          <span className="flex min-h-7 w-full items-center gap-2 text-muted-foreground text-xs">
            <span className="line-clamp-2">{props.setupMessage}</span>
            <InlineButton onClick={props.onSetup}>Set up</InlineButton>
          </span>
        ) : null}
      </div>
    </div>
  );
}
