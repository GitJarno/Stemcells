// The phone's pick (`stemcells/tasks/model-pick.md`): Model, Effort and Access on one grid, the
// agents' marks in a gutter and every choice a track beside it, one tap that applies at once; a
// wide sheet sets Model beside the rest. T3's session (the sheet's provider) reads and writes,
// and its whole catalog stays one tap away.
import { useAtomValue } from "@effect/atom-react";
import * as Haptics from "expo-haptics";
import { useMessages } from "gt-react-native";
import { type Context, type ReactNode, use, useState } from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ANTIGRAVITY_DEFAULT_MODEL,
  AppText,
  canCommitPendingModel,
  ChatGptSharingStatus,
  Chip,
  compareSemverVersions,
  Dialog,
  environmentServerConfigsAtom,
  getProviderOptionCurrentValue,
  groupModelsBySubProvider,
  isReasoningControl,
  type ModelOption,
  type ProviderGroup,
  type ProviderOptionDescriptor,
  ProviderIcon,
  type RuntimeMode,
  SegmentedControl,
  selectableChoices,
  SymbolView,
  type ThreadSettingsSessionProps,
  type ThreadSettingsSessionValue,
} from "../upstream/modelPick";
import { ACCESS_WORDS, levelLabel, lineup, type LineupEntry, selectedIn } from "./kit";
import { PickOffersAccess } from "./pickScope";
import { useSheetFit } from "./pickSheet";

type Select = Extract<ProviderOptionDescriptor, { type: "select" }>;
type Switch = Extract<ProviderOptionDescriptor, { type: "boolean" }>;
interface PickModel {
  readonly slug: string;
  readonly name: string;
  readonly isLegacy: boolean;
  readonly isDefault: boolean;
  readonly option: ModelOption;
}
type Line = ReturnType<typeof linesOf>[number];

/** No segment lit: a value no option has, as when Ultrathink in the prompt owns effort. */
const NONE = "\u0000";
/** The marks' gutter, and the gap before the tracks: every caption and track starts after both. */
const GUTTER = 28;
const GAP = 12;
const INSET = GUTTER + GAP;
/** From this width the sheet sets Model beside Effort and Access: under it, "Supervised" and
 * "Medium" no longer fit their segments (the open Duo's sheet, about 650 points, stays one column). */
const WIDE = 720;

export function CellPick(
  props: ThreadSettingsSessionProps & {
    readonly onClose: () => void;
    readonly session: Context<ThreadSettingsSessionValue | null>;
    /** T3's whole catalog: every version, search, favourites, hiding. */
    readonly catalog: ReactNode;
  },
) {
  const session = use(props.session);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [width, setWidth] = useState(0);
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const configs = useAtomValue(environmentServerConfigsAtom);
  const fit = useSheetFit();
  if (!session) return null;
  if (catalogOpen) return <View className="flex-1">{props.catalog}</View>;

  const wide = width >= WIDE;
  const selection = session.displayedModelSelection;
  const lines = session.providerGroups.flatMap((group) =>
    linesOf(group, group.providerKey === selection?.instanceId ? selection.model : null),
  );
  const activeLine = lines.find((line) => line.lit !== null);
  const active = activeLine ? selectedIn(activeLine.entries, activeLine.selectedSlug) : null;
  const provider = session.environmentId
    ? (configs
        .get(session.environmentId)
        ?.providers.find((entry) => entry.instanceId === session.providerInstanceId) ?? null)
    : null;

  const choose = (option: ModelOption) => {
    if (session.isApplied(option)) return;
    if (!canCommitPendingModel(option, session.providerGroups)) {
      Dialog.alert("Model unavailable", "Set this agent up on the Mac, or pick another model.");
      return;
    }
    void Haptics.selectionAsync();
    props.onSelectModel(
      props.restoreSelection
        ? { ...option, selection: props.restoreSelection(option.selection) }
        : option,
    );
  };

  const models = (
    <Section title="Model" inset>
      {/* An agent with a long catalog scrolls here; the sheet only fits what shows. */}
      <ScrollView
        style={{ maxHeight: window.height * (wide ? 0.6 : 0.4) }}
        contentContainerStyle={{ gap: 12 }}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {lines.map((line) => (
          <ModelLine
            key={line.key}
            line={line}
            // The agent this Cell runs stands out; the others wait a step back.
            quiet={activeLine !== undefined && line.group !== activeLine.group}
            onChoose={choose}
          />
        ))}
      </ScrollView>
    </Section>
  );
  const levels =
    active && active.entry.levels.length > 0 ? (
      <SegmentedControl<string>
        options={active.entry.levels.map((level) => ({
          value: level.id || "default",
          label: level.label,
        }))}
        selected={active.level === null ? NONE : active.level || "default"}
        onSelect={(value) => {
          const level = active.entry.levels.find((entry) => (entry.id || "default") === value);
          if (level) choose(level.model.option);
        }}
      />
    ) : null;
  const settings = (
    <>
      <OptionSections session={session} levels={levels} inset={!wide} />
      <AccessSection session={session} inset={!wide} />
    </>
  );

  return (
    // Laid out on its own (absolute), so the sheet's height, 0 until it fits, never squeezes it.
    <View
      className="bg-sheet"
      onLayout={(event) => {
        fit.onLayout(event);
        setWidth(event.nativeEvent.layout.width);
      }}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        paddingTop: 22,
        paddingBottom: Math.max(insets.bottom, 16),
        paddingLeft: Math.max(20, insets.left + 12),
        paddingRight: Math.max(20, insets.right + 12),
      }}
    >
      {wide ? (
        <View className="flex-row" style={{ gap: 32 }}>
          <View style={{ flex: 1.2 }}>{models}</View>
          <View style={{ flex: 1, gap: 22 }}>{settings}</View>
        </View>
      ) : (
        <View style={{ gap: 22 }}>
          {models}
          {settings}
        </View>
      )}

      <ChatGptSharingStatus provider={provider} />
      <Pressable
        accessibilityRole="button"
        className="mt-4 flex-row items-center gap-1 self-center px-4 py-2"
        onPress={() => {
          fit.whole();
          setCatalogOpen(true);
        }}
      >
        <AppText textRole="footnote" className="text-foreground-muted">
          All models
        </AppText>
        <SymbolView name="chevron.right" size={11} tintColorClassName="accent-icon-muted" />
      </Pressable>
    </View>
  );
}

/** A caption over its controls, both starting at the tracks' edge when inset past the marks. */
function Section(props: {
  readonly title: string;
  readonly inset: boolean;
  readonly accessory?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <View style={{ gap: 8 }}>
      <View
        className="flex-row items-center justify-between"
        style={{ minHeight: 26, paddingLeft: props.inset ? INSET : 0 }}
      >
        <AppText textRole="footnote" className="font-t3-medium text-foreground-muted">
          {props.title}
        </AppText>
        {props.accessory ? <View className="flex-row gap-1.5">{props.accessory}</View> : null}
      </View>
      {props.children}
    </View>
  );
}

/** One agent's families as one track, its mark in the gutter; a name or note sits on the track's edge. */
function ModelLine(props: {
  readonly line: Line;
  readonly quiet: boolean;
  readonly onChoose: (option: ModelOption) => void;
}) {
  const { line } = props;
  return (
    <View style={{ gap: 4 }}>
      {line.label ? (
        <AppText textRole="label" className="text-foreground-muted" style={{ paddingLeft: INSET }}>
          {line.label}
        </AppText>
      ) : null}
      <View className="flex-row items-center" style={{ gap: GAP }}>
        <View
          className="items-center justify-center"
          style={{ width: GUTTER, height: 36, opacity: props.quiet ? 0.45 : 1 }}
        >
          <ProviderIcon provider={line.driver} iconUrl={line.iconUrl} size={20} />
        </View>
        {line.entries.length > 0 ? (
          <SegmentedControl<string>
            className="flex-1"
            options={line.entries.map((entry) => ({
              value: entry.key,
              label: entry.label,
              accessibilityLabel: `${entry.label}, ${line.group.providerLabel}`,
            }))}
            selected={line.lit?.key ?? NONE}
            onSelect={(key) => {
              const entry = line.entries.find((candidate) => candidate.key === key);
              if (entry) props.onChoose(entry.model.option);
            }}
          />
        ) : (
          <View className="flex-1" />
        )}
      </View>
      {line.notes.map((note) => (
        <AppText
          key={note}
          textRole="label"
          className="text-foreground-muted"
          style={{ paddingLeft: INSET }}
        >
          {note}
        </AppText>
      ))}
    </View>
  );
}

/**
 * An agent's lines: its own models, then one per backend it runs models on (fx's), each named.
 * Antigravity's default alias lights the model it stands for; hidden models stay hidden.
 */
function linesOf(group: ProviderGroup, selected: string | null) {
  const first = group.models[0];
  const driver = first?.providerDriver;
  const alias = (option: ModelOption) =>
    driver === "antigravity" && option.selection.model === ANTIGRAVITY_DEFAULT_MODEL;
  const offered = group.models.filter(
    (option) => !alias(option) && (!option.isHidden || option.selection.model === selected),
  );
  const selectedSlug =
    driver === "antigravity" && selected === ANTIGRAVITY_DEFAULT_MODEL
      ? (offered.find((option) => option.isDefault)?.selection.model ?? null)
      : selected;
  const split = group.subProviders?.length
    ? groupModelsBySubProvider(offered, group.subProviders, (option) => option.subtitle)
    : null;
  const parts = [
    { backend: null, options: split ? split.ungrouped : offered },
    ...(split?.groups.map((part) => ({ backend: part.subProvider, options: part.models })) ?? []),
  ];
  const update = updateNote(group);
  return parts
    .map(({ backend, options }) => {
      const reasonOnly = backend?.unavailableReason !== undefined;
      const models: PickModel[] = reasonOnly
        ? []
        : options.map((option) => ({
            slug: option.selection.model,
            name: withoutBackend(option.label, option.subtitle),
            isLegacy: option.isLegacy,
            isDefault: option.isDefault,
            option,
          }));
      const entries: LineupEntry<PickModel>[] = lineup(models, selectedSlug);
      return {
        key: `${group.providerKey}\u0000${backend?.name ?? ""}`,
        group,
        entries,
        selectedSlug,
        lit: selectedIn(entries, selectedSlug)?.entry ?? null,
        driver,
        iconUrl: first?.providerIconUrl,
        // Two accounts of one agent say which is which; a backend says its name.
        label: backend?.name ?? (first?.providerBadge?.showBadge ? group.providerLabel : null),
        notes: [backend?.unavailableReason, backend ? null : update].filter(
          (note): note is string => typeof note === "string",
        ),
      };
    })
    .filter((line) => line.entries.length > 0 || line.notes.length > 0);
}

/** Under the agent's own track, so it needs neither the agent's name nor the models'. */
function updateNote(group: ProviderGroup) {
  const versions = group.updateRequired?.updateRequiredModels?.map((model) => model.minVersion);
  if (!versions?.length) return null;
  const newest = versions.reduce((highest, version) =>
    compareSemverVersions(version, highest) > 0 ? version : highest,
  );
  return `Update to ${newest} for its newest models.`;
}

/** "Anthropic: Opus 5.5" under its backend's name reads "Opus 5.5". */
function withoutBackend(name: string, backend: string) {
  const head = name.slice(0, backend.length);
  const rest = name.slice(backend.length);
  if (!backend || head.toLowerCase() !== backend.toLowerCase() || !/^[\s.:/-]/.test(rest)) {
    return name;
  }
  return rest.replace(/^\s*[.:/-]?\s*/, "") || name;
}

/**
 * Effort: the family's baked levels or the model's own, with its switches (Fast, Ultracode) on
 * the caption's line; then any other choice the model offers, a section each.
 */
function OptionSections(props: {
  readonly session: ThreadSettingsSessionValue;
  readonly levels: ReactNode;
  readonly inset: boolean;
}) {
  const { session } = props;
  const descriptors = session.displayedDescriptors;
  const selects = descriptors.filter((entry): entry is Select => entry.type === "select");
  const switches = descriptors.filter((entry): entry is Switch => entry.type === "boolean");
  const effort = selects.find(isReasoningControl);
  const hasUltracodeSwitch = switches.some((entry) => entry.id === "ultracode");
  const primary = session.promptTraits.primarySelectDescriptor?.id;
  const valueOf = (descriptor: Select) => {
    if (session.promptTraits.ultrathinkPromptControlled && descriptor.id === primary) {
      return "ultrathink";
    }
    const value = getProviderOptionCurrentValue(
      descriptor,
      session.displayedModelSelection,
      session.reportedModelSelection,
    );
    return typeof value === "string" ? value : NONE;
  };
  const apply = (id: string, value: string | boolean) => {
    void Haptics.selectionAsync();
    session.applyOptionChange(id, value);
  };
  const track = (descriptor: Select) => {
    const locked = session.promptTraits.ultrathinkInBodyText && descriptor.id === primary;
    const choices = selectableChoices(descriptor).filter(
      (choice) => !(hasUltracodeSwitch && choice.id === "ultracode"),
    );
    return (
      <View key={descriptor.id} style={{ gap: 6, paddingLeft: props.inset ? INSET : 0 }}>
        <View pointerEvents={locked ? "none" : "auto"} style={{ opacity: locked ? 0.5 : 1 }}>
          <SegmentedControl<string>
            options={choices.map((choice) => ({
              value: choice.id,
              label: descriptor === effort ? levelLabel(choice.label) : choice.label,
            }))}
            selected={valueOf(descriptor)}
            onSelect={(value) => apply(descriptor.id, value)}
          />
        </View>
        {locked ? (
          <AppText textRole="label" className="text-foreground-muted">
            Ultrathink in your message sets the effort.
          </AppText>
        ) : null}
      </View>
    );
  };
  // Fast first: it is the one most reached for.
  const ordered = [...switches].sort(
    (a, b) => Number(b.id === "fastMode") - Number(a.id === "fastMode"),
  );
  const toggles = ordered.map((descriptor) => (
    <Chip
      key={descriptor.id}
      size="small"
      label={descriptor.id === "fastMode" ? "Fast" : descriptor.label}
      {...(descriptor.id === "fastMode"
        ? { icon: "bolt.circle" as const }
        : descriptor.id === "ultracode"
          ? { icon: "point.3.connected.trianglepath.dotted" as const }
          : {})}
      selected={descriptor.currentValue === true}
      onPress={() => apply(descriptor.id, descriptor.currentValue !== true)}
    />
  ));
  const hasEffort = props.levels !== null || effort !== undefined;
  return (
    <>
      {hasEffort || toggles.length > 0 ? (
        <Section title={hasEffort ? "Effort" : "Options"} inset={props.inset} accessory={toggles}>
          {props.levels ? (
            <View style={{ paddingLeft: props.inset ? INSET : 0 }}>{props.levels}</View>
          ) : null}
          {effort ? track(effort) : null}
        </Section>
      ) : null}
      {selects
        .filter((descriptor) => descriptor !== effort)
        .map((descriptor) => (
          <Section key={descriptor.id} title={descriptor.label} inset={props.inset}>
            {track(descriptor)}
          </Section>
        ))}
    </>
  );
}

/** Access in four words; a mode this agent or a policy refuses leaves the track. */
function AccessSection(props: {
  readonly session: ThreadSettingsSessionValue;
  readonly inset: boolean;
}) {
  const messages = useMessages();
  const { session } = props;
  const offered = use(PickOffersAccess);
  const choices = session.runtimeModeChoices.filter(
    (choice) => choice.disabledReason === undefined || choice.mode === session.runtimeMode,
  );
  if (!offered || choices.length < 2) return null;
  return (
    <Section title="Access" inset={props.inset}>
      <View style={{ paddingLeft: props.inset ? INSET : 0 }}>
        <SegmentedControl<RuntimeMode>
          options={choices.map((choice) => ({
            value: choice.mode,
            label: ACCESS_WORDS[choice.mode] ?? messages(choice.label),
            accessibilityLabel: messages(choice.label),
          }))}
          selected={session.runtimeMode}
          onSelect={(mode) => {
            void Haptics.selectionAsync();
            session.onUpdateRuntimeMode(mode);
          }}
        />
      </View>
    </Section>
  );
}
