// The pick's Effort and Access sections (`stemcells/tasks/model-pick.md`), under its Model section
// on the same grid: the model's levels as one track with its switches (Fast, Ultracode) on the
// caption's line, any other choice a section of its own, then Access as one track. Every choice
// is a press: nothing opens a menu. T3's traits hook reads and writes each option.
import { useMessages } from "gt-react";
import { WorkflowIcon } from "lucide-react";
import { type MouseEvent, type ReactNode, use } from "react";

import {
  FastBolt,
  isReasoningControl,
  type ProviderOptionDescriptor,
  type RuntimeMode,
  type RuntimeModeOption,
  RuntimeModeLimitsTargetContext,
  selectableProviderOptionChoices,
  Toggle,
  ToggleGroup,
  type TraitsSelectionInput,
  ULTRATHINK_IN_BODY_NOTE,
  useProviderRuntimeModeLimits,
  useTraitsSelection,
} from "../upstream/modelPick";
import { ACCESS_WORDS, levelLabel } from "./lineup";
import { PickSection } from "./PickSection";
import { PickLevels } from "./pickSlots";

type Select = Extract<ProviderOptionDescriptor, { type: "select" }>;
type Traits = ReturnType<typeof useTraitsSelection>;

/** Effort, with the family's baked levels the pick hands over; nothing when there is neither. */
export function PickEffort(props: { readonly traits: TraitsSelectionInput | null }) {
  const levels = use(PickLevels);
  if (props.traits) return <EffortSections traits={props.traits} levels={levels} />;
  return levels ? <PickSection title="Effort">{levels}</PickSection> : null;
}

function EffortSections(props: {
  readonly traits: TraitsSelectionInput;
  readonly levels: ReactNode;
}) {
  const traits = useTraitsSelection(props.traits);
  if (traits.modelIsUnavailable) {
    // Nothing to change on a model the agent no longer offers; what it ran with still shows.
    const values = traits.descriptors.flatMap((descriptor) => {
      const value = traits.currentLabel(descriptor);
      return value ? [`${descriptor.label}: ${value}`] : [];
    });
    return values.length > 0 ? (
      <PickSection title="Effort">
        <p className="text-muted-foreground text-xs">{values.join(" · ")}</p>
      </PickSection>
    ) : null;
  }
  const selects = traits.selectDescriptors.filter((descriptor) => descriptor.id !== "serviceTier");
  const effort = selects.find(isReasoningControl);
  const others = selects.filter((descriptor) => descriptor !== effort);
  const locked =
    effort !== undefined &&
    effort.id === traits.primarySelectDescriptor?.id &&
    traits.ultrathinkInBodyText;
  const switches = <Switches traits={traits} />;
  const hasSwitches = switchDescriptors(traits).length > 0 || tierOf(traits) !== undefined;
  const hasEffort = props.levels !== null || effort !== undefined;
  return (
    <>
      {hasEffort || hasSwitches ? (
        <PickSection title={hasEffort ? "Effort" : "Options"} accessory={switches}>
          {props.levels}
          {effort ? (
            <SelectTrack descriptor={effort} traits={traits} locked={locked} effort />
          ) : null}
        </PickSection>
      ) : null}
      {others.map((descriptor) => (
        <PickSection key={descriptor.id} title={descriptor.label}>
          <SelectTrack descriptor={descriptor} traits={traits} locked={false} />
        </PickSection>
      ))}
    </>
  );
}

function SelectTrack(props: {
  readonly descriptor: Select;
  readonly traits: Traits;
  readonly locked: boolean;
  readonly effort?: boolean;
}) {
  const messages = useMessages();
  const { descriptor, traits } = props;
  const value = traits.selectValue(descriptor);
  // Ultracode is a switch of its own where the model gives it one.
  const hasUltracodeSwitch = traits.booleanDescriptors.some((entry) => entry.id === "ultracode");
  const choices = selectableProviderOptionChoices(descriptor).filter(
    (choice) => !(hasUltracodeSwitch && choice.id === "ultracode"),
  );
  return (
    <>
      <ToggleGroup
        className="w-full"
        aria-label={descriptor.label}
        disabled={props.locked}
        value={choices.some((choice) => choice.id === value) ? [value] : []}
        onValueChange={(next) => {
          if (next[0] !== undefined && next[0] !== value) traits.changeSelect(descriptor, next[0]);
        }}
      >
        {choices.map((choice) => (
          <Toggle
            key={choice.id}
            value={choice.id}
            className="flex-1"
            title={choice.description}
            // T3's picker focuses the level marked so, the one picked, else a row's first.
            data-effort-level={props.effort && choice.id === value ? "" : undefined}
            data-effort-row={props.effort ? undefined : ""}
          >
            {props.effort ? levelLabel(choice.label) : choice.label}
          </Toggle>
        ))}
      </ToggleGroup>
      {props.locked ? (
        <p className="text-muted-foreground text-xs">{messages(ULTRATHINK_IN_BODY_NOTE)}</p>
      ) : null}
    </>
  );
}

/** Access in four words, one track: a mode this agent or a policy refuses can't be pressed. */
export function PickFooter(props: {
  readonly traits: TraitsSelectionInput | null;
  readonly runtimeMode: RuntimeMode;
  readonly runtimeModeOptions: ReadonlyArray<RuntimeModeOption>;
  readonly onRuntimeModeChange: (mode: RuntimeMode) => void;
}) {
  const current = props.runtimeModeOptions.find((option) => option.mode === props.runtimeMode);
  // Mounted only while the pick is open, so this asks again each time, as T3's footer did.
  useProviderRuntimeModeLimits(use(RuntimeModeLimitsTargetContext), "picker");
  if (!current) return null;
  return (
    <PickSection title="Access">
      <span
        // T3's permissions shortcut presses this; it lands on the mode in use.
        data-composer-permissions-trigger
        className="flex"
        onClick={(event: MouseEvent<HTMLSpanElement>) => {
          if (event.target !== event.currentTarget) return;
          event.currentTarget.querySelector<HTMLElement>("[data-pressed]")?.focus();
        }}
      >
        <ToggleGroup
          className="w-full"
          aria-label="Access"
          value={[props.runtimeMode]}
          onValueChange={(next) => {
            const mode = next[0] as RuntimeMode | undefined;
            if (mode !== undefined && mode !== props.runtimeMode) props.onRuntimeModeChange(mode);
          }}
        >
          {props.runtimeModeOptions.map((option) => (
            <Toggle
              key={option.mode}
              value={option.mode}
              className="flex-1"
              disabled={option.disabledReason !== undefined}
              title={option.disabledReason ?? option.description}
              aria-label={option.label}
            >
              {ACCESS_WORDS[option.mode]}
            </Toggle>
          ))}
        </ToggleGroup>
      </span>
    </PickSection>
  );
}

const tierOf = (traits: Traits) =>
  traits.selectDescriptors.find((descriptor) => descriptor.id === "serviceTier");

/** Fast first, the one most reached for; a model's thinking switch beside its others. */
function switchDescriptors(traits: Traits) {
  const thinking = traits.booleanDescriptors.find(isReasoningControl);
  const others = traits.booleanDescriptors
    .filter((descriptor) => !isReasoningControl(descriptor))
    .toSorted((a, b) => Number(b.id === "fastMode") - Number(a.id === "fastMode"));
  return [...(thinking ? [thinking] : []), ...others];
}

/** The model's switches on the Effort caption's line: a speed tier, then its on-off switches. */
function Switches(props: { readonly traits: Traits }) {
  const { traits } = props;
  const tier = tierOf(traits);
  const switches = switchDescriptors(traits);
  const on = switches.filter((descriptor) => descriptor.currentValue === true);
  const icon = (id: string): ReactNode =>
    id === "fastMode" ? (
      <FastBolt ultra={false} />
    ) : id === "ultracode" ? (
      <WorkflowIcon aria-hidden="true" className="size-3" />
    ) : null;
  if (!tier && switches.length === 0) return null;
  return (
    <div className="flex gap-1.5">
      {tier ? (
        <ToggleGroup
          aria-label={tier.label}
          value={[traits.selectValue(tier)]}
          onValueChange={(next) => {
            if (next[0] !== undefined) traits.changeSelect(tier, next[0]);
          }}
        >
          {selectableProviderOptionChoices(tier).map((choice) => (
            <Toggle key={choice.id} value={choice.id} title={choice.description} data-effort-row="">
              {choice.label === "Fast" || choice.label === "Ultrafast" ? (
                <FastBolt ultra={choice.label === "Ultrafast"} />
              ) : null}
              {choice.label}
            </Toggle>
          ))}
        </ToggleGroup>
      ) : null}
      {switches.length > 0 ? (
        <ToggleGroup
          multiple
          aria-label="Switches"
          value={on.map((descriptor) => descriptor.id)}
          onValueChange={(next) => {
            for (const descriptor of switches) {
              const wanted = next.includes(descriptor.id);
              if (wanted !== (descriptor.currentValue === true)) {
                traits.changeBoolean(descriptor.id, wanted);
              }
            }
          }}
        >
          {switches.map((descriptor) => (
            <Toggle key={descriptor.id} value={descriptor.id} data-effort-row="">
              {icon(descriptor.id)}
              {descriptor.id === "fastMode" ? "Fast" : descriptor.label}
            </Toggle>
          ))}
        </ToggleGroup>
      ) : null}
    </div>
  );
}
