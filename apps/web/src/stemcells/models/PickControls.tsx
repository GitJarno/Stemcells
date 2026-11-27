// Under the pick's lines (`stemcells/tasks/model-pick.md`): the model's effort as one row of
// levels, its other choices as rows of their own, then its switches and Access in a row. Every
// choice is a press: nothing opens a menu. T3's traits hook reads and writes each option.
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
import { cn } from "../upstream/ui";
import { ACCESS_WORDS, levelLabel } from "./lineup";

type Select = Extract<ProviderOptionDescriptor, { type: "select" }>;
type Traits = ReturnType<typeof useTraitsSelection>;

const ROW = "flex items-center gap-2 border-t border-border/70 px-3 py-2";

/** The model's levels, then any other choice it offers; nothing when it offers none. */
export function PickEffort(props: { readonly traits: TraitsSelectionInput | null }) {
  return props.traits ? <EffortRows traits={props.traits} /> : null;
}

function EffortRows(props: { readonly traits: TraitsSelectionInput }) {
  const traits = useTraitsSelection(props.traits);
  if (traits.modelIsUnavailable) {
    // Nothing to change on a model the agent no longer offers; what it ran with still shows.
    const values = traits.descriptors.flatMap((descriptor) => {
      const value = traits.currentLabel(descriptor);
      return value ? [`${descriptor.label}: ${value}`] : [];
    });
    return values.length > 0 ? (
      <p className={cn(ROW, "text-muted-foreground text-xs")}>{values.join(" · ")}</p>
    ) : null;
  }
  const selects = traits.selectDescriptors.filter((descriptor) => descriptor.id !== "serviceTier");
  const effort = selects.find(isReasoningControl);
  const others = selects.filter((descriptor) => descriptor !== effort);
  if (!effort && others.length === 0) return null;
  const locked =
    effort !== undefined &&
    effort.id === traits.primarySelectDescriptor?.id &&
    traits.ultrathinkInBodyText;
  return (
    <div className="flex flex-col">
      {effort ? <SelectRow descriptor={effort} traits={traits} locked={locked} effort /> : null}
      {others.map((descriptor) => (
        <SelectRow key={descriptor.id} descriptor={descriptor} traits={traits} locked={false} />
      ))}
    </div>
  );
}

function SelectRow(props: {
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
    <div className={cn(ROW, "flex-wrap")}>
      {props.locked ? (
        <p className="w-full text-muted-foreground text-xs">{messages(ULTRATHINK_IN_BODY_NOTE)}</p>
      ) : null}
      {props.effort ? null : (
        <span className="shrink-0 text-muted-foreground text-xs">{descriptor.label}</span>
      )}
      <ToggleGroup
        className="min-w-0 flex-1"
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
    </div>
  );
}

/** The model's switches (Fast, Ultracode, any other) and Access, in one row that wraps. */
export function PickFooter(props: {
  readonly traits: TraitsSelectionInput | null;
  readonly runtimeMode: RuntimeMode;
  readonly runtimeModeOptions: ReadonlyArray<RuntimeModeOption>;
  readonly onRuntimeModeChange: (mode: RuntimeMode) => void;
}) {
  const current = props.runtimeModeOptions.find((option) => option.mode === props.runtimeMode);
  // Mounted only while the pick is open, so this asks again each time, as T3's footer did.
  useProviderRuntimeModeLimits(use(RuntimeModeLimitsTargetContext), "picker");
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border/70 px-3 py-2">
      {props.traits ? <Switches traits={props.traits} /> : null}
      {current ? (
        <span
          // T3's permissions shortcut presses this; it lands on the mode in use.
          data-composer-permissions-trigger
          className="ms-auto"
          onClick={(event: MouseEvent<HTMLSpanElement>) => {
            if (event.target !== event.currentTarget) return;
            event.currentTarget.querySelector<HTMLElement>("[data-pressed]")?.focus();
          }}
        >
          <ToggleGroup
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
                disabled={option.disabledReason !== undefined}
                title={option.disabledReason ?? option.description}
                aria-label={option.label}
              >
                {ACCESS_WORDS[option.mode]}
              </Toggle>
            ))}
          </ToggleGroup>
        </span>
      ) : null}
    </div>
  );
}

function Switches(props: { readonly traits: TraitsSelectionInput }) {
  const traits = useTraitsSelection(props.traits);
  if (traits.modelIsUnavailable) return null;
  const tier = traits.selectDescriptors.find((descriptor) => descriptor.id === "serviceTier");
  const switches = traits.booleanDescriptors.filter(
    (descriptor) => !isReasoningControl(descriptor),
  );
  const thinking = traits.booleanDescriptors.find(isReasoningControl);
  const on = [...switches, ...(thinking ? [thinking] : [])].filter(
    (descriptor) => descriptor.currentValue === true,
  );
  const icon = (id: string): ReactNode =>
    id === "fastMode" ? (
      <FastBolt ultra={false} />
    ) : id === "ultracode" ? (
      <WorkflowIcon aria-hidden="true" className="size-3" />
    ) : null;
  return (
    <>
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
      {switches.length > 0 || thinking ? (
        <ToggleGroup
          multiple
          aria-label="Switches"
          value={on.map((descriptor) => descriptor.id)}
          onValueChange={(next) => {
            for (const descriptor of [...switches, ...(thinking ? [thinking] : [])]) {
              const wanted = next.includes(descriptor.id);
              if (wanted !== (descriptor.currentValue === true)) {
                traits.changeBoolean(descriptor.id, wanted);
              }
            }
          }}
        >
          {[...(thinking ? [thinking] : []), ...switches].map((descriptor) => (
            <Toggle key={descriptor.id} value={descriptor.id} data-effort-row="">
              {icon(descriptor.id)}
              {descriptor.id === "fastMode" ? "Fast" : descriptor.label}
            </Toggle>
          ))}
        </ToggleGroup>
      ) : null}
    </>
  );
}
