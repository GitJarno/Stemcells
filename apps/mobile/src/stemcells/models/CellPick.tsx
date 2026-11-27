// The phone's pick (`stemcells/tasks/model-pick.md`): each agent one line of its models by
// family, then the model's effort, switches and Access, every choice one tap that applies at
// once, in a sheet that fits them. T3's session (the sheet's provider) reads and writes; its
// whole catalog stays one tap away for hiding models and browsing every version.
import { useAtomValue } from "@effect/atom-react";
import * as Haptics from "expo-haptics";
import { useMessages } from "gt-react-native";
import { type Context, type ReactNode, use, useState } from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppText,
  canCommitPendingModel,
  ChatGptSharingStatus,
  Chip,
  Dialog,
  environmentServerConfigsAtom,
  getProviderOptionCurrentValue,
  isReasoningControl,
  type ModelOption,
  type ProviderGroup,
  type ProviderOptionDescriptor,
  ProviderIcon,
  type RuntimeMode,
  SegmentedControl,
  selectableChoices,
  type ThreadSettingsSessionProps,
  type ThreadSettingsSessionValue,
} from "../upstream/modelPick";
import { ACCESS_WORDS, levelLabel, lineup, type LineupEntry, selectedIn } from "./kit";

type Select = Extract<ProviderOptionDescriptor, { type: "select" }>;
type Switch = Extract<ProviderOptionDescriptor, { type: "boolean" }>;
interface PickModel {
  readonly slug: string;
  readonly name: string;
  readonly isLegacy: boolean;
  readonly isDefault: boolean;
  readonly option: ModelOption;
}
/** No segment lit: a value no option has, as when Ultrathink in the prompt owns effort. */
const NONE = "\u0000";

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
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const configs = useAtomValue(environmentServerConfigsAtom);
  if (!session) return null;
  // The sheet fits its content, so the catalog asks for most of the screen.
  if (catalogOpen) return <View style={{ height: window.height * 0.9 }}>{props.catalog}</View>;

  const selection = session.displayedModelSelection;
  const lines = session.providerGroups.map((group) =>
    lineOf(group, group.providerKey === selection?.instanceId ? selection.model : null),
  );
  const activeLine = lines.find((line) => line.group.providerKey === selection?.instanceId);
  const active = activeLine ? selectedIn(activeLine.entries, selection?.model ?? null) : null;
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

  return (
    <View
      className="bg-sheet"
      style={{
        paddingTop: 28,
        paddingBottom: insets.bottom + 12,
        paddingLeft: Math.max(20, insets.left + 12),
        paddingRight: Math.max(20, insets.right + 12),
      }}
    >
      {/* An agent with a long catalog scrolls here; the sheet only fits what shows. */}
      <ScrollView
        style={{ maxHeight: window.height * 0.45 }}
        contentContainerClassName="gap-2.5"
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {lines.map((line) => (
          <View key={line.group.providerKey} className="flex-row items-start gap-3">
            <View className="h-8 w-6 items-center justify-center">
              <ProviderIcon provider={line.driver} iconUrl={line.iconUrl} size={20} />
            </View>
            <View className="flex-1 flex-row flex-wrap gap-2">
              {line.named ? (
                <AppText textRole="footnote" className="self-center text-foreground-muted">
                  {line.group.providerLabel}
                </AppText>
              ) : null}
              {line.entries.map((entry) => (
                <Chip
                  key={entry.key}
                  label={entry.label}
                  selected={entry === line.lit}
                  accessibilityLabel={`${entry.label}, ${line.group.providerLabel}`}
                  onPress={() => choose(entry.model.option)}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <View className="mt-6 gap-3">
        {active && active.entry.levels.length > 0 ? (
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
        ) : null}
        <OptionRows session={session} />
        <AccessRow session={session} />
      </View>

      <ChatGptSharingStatus provider={provider} />
      <Pressable
        accessibilityRole="button"
        className="mt-3 self-center px-4 py-2"
        onPress={() => setCatalogOpen(true)}
      >
        <AppText textRole="footnote" className="text-foreground-muted">
          All models
        </AppText>
      </Pressable>
    </View>
  );
}

function lineOf(group: ProviderGroup, selectedSlug: string | null) {
  const models: PickModel[] = group.models.map((option) => ({
    slug: option.selection.model,
    name: option.label,
    isLegacy: option.isLegacy,
    isDefault: option.isDefault,
    option,
  }));
  const entries: LineupEntry<PickModel>[] = lineup(models, selectedSlug);
  const first = group.models[0];
  return {
    group,
    entries,
    lit: selectedIn(entries, selectedSlug)?.entry ?? null,
    driver: first?.providerDriver,
    iconUrl: first?.providerIconUrl,
    // Two accounts of one agent say which is which.
    named: first?.providerBadge?.showBadge === true,
  };
}

/** The model's effort, its other choices, then its switches, from T3's descriptors. */
function OptionRows(props: { readonly session: ThreadSettingsSessionValue }) {
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
  return (
    <>
      {[...(effort ? [effort] : []), ...selects.filter((entry) => entry !== effort)].map(
        (descriptor) => {
          const locked = session.promptTraits.ultrathinkInBodyText && descriptor.id === primary;
          const choices = selectableChoices(descriptor).filter(
            (choice) => !(hasUltracodeSwitch && choice.id === "ultracode"),
          );
          return (
            <View key={descriptor.id} className="gap-1.5">
              {descriptor === effort ? null : (
                <AppText textRole="footnote" className="text-foreground-muted">
                  {descriptor.label}
                </AppText>
              )}
              {locked ? (
                <AppText textRole="footnote" className="text-foreground-muted">
                  Ultrathink in your message sets the effort.
                </AppText>
              ) : null}
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
            </View>
          );
        },
      )}
      {switches.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {switches.map((descriptor) => (
            <Chip
              key={descriptor.id}
              label={descriptor.id === "fastMode" ? "Fast" : descriptor.label}
              {...(descriptor.id === "fastMode"
                ? { icon: "bolt.circle" as const }
                : descriptor.id === "ultracode"
                  ? { icon: "point.3.connected.trianglepath.dotted" as const }
                  : {})}
              selected={descriptor.currentValue === true}
              onPress={() => apply(descriptor.id, descriptor.currentValue !== true)}
            />
          ))}
        </View>
      ) : null}
    </>
  );
}

/** Access in four words; a mode this agent or a policy refuses leaves the row. */
function AccessRow(props: { readonly session: ThreadSettingsSessionValue }) {
  const messages = useMessages();
  const { session } = props;
  const choices = session.runtimeModeChoices.filter(
    (choice) => choice.disabledReason === undefined || choice.mode === session.runtimeMode,
  );
  if (choices.length < 2) return null;
  return (
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
  );
}
