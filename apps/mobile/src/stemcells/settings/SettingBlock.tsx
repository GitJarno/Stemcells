// A `setting` fence in a reply on the phone, as the Mac draws it (stemcells/tasks/settings-in-chat.md):
// a card whose rows are the settings it names. A setting of the chat's machine is its live control,
// a suggested value waits for Apply, and a change made here can be undone. A setting kept on the
// Mac's own device opens the phone's page for it, or says it lives on the Mac.
import * as Linking from "expo-linking";
import { useState, type ReactNode } from "react";
import { Pressable, Text, View, type TextStyle } from "react-native";

import {
  BINDINGS,
  controlOf,
  optionLabel,
  rowStatus,
  YOURS,
  type Binding,
  type Control,
} from "../../../../../stemcells/settings/controls.ts";
import type { FenceLine } from "../../../../../stemcells/settings/fence.ts";
import { crumbsFor, type SettingsPlace } from "../../../../../stemcells/settings/places.ts";
import type { ChartInk } from "../chart/ChartBlock";
import { PHONE_PAGES } from "../chat/placeLinks";
import { useChatInView } from "../chat/inView";
import { serverSettingAst, ThemedSwitch, useMachineSetting } from "../upstream/machineSettings";

type Value = boolean | string | null;

const open = (page: string) => void Linking.openURL(Linking.createURL(page));
const titleOf = (place: SettingsPlace) => {
  const crumbs = crumbsFor(place);
  return crumbs[crumbs.length - 1]!;
};

export function SettingBlock(props: {
  readonly lines: ReadonlyArray<FenceLine>;
  readonly ink: ChartInk;
}) {
  const { ink } = props;
  const chat = useChatInView();
  const pages = new Set(props.lines.flatMap((line) => ("place" in line ? [line.place.page] : [])));
  const page = pages.size === 1 ? [...pages][0]! : null;
  const phonePage = page === null ? undefined : PHONE_PAGES[page];
  const head: TextStyle = {
    color: ink.muted,
    fontFamily: ink.fontFamily,
    fontSize: ink.fontSize * 0.85,
  };
  return (
    <View
      accessibilityLabel="Settings"
      style={{ borderWidth: 1, borderColor: ink.rule, borderRadius: 12, overflow: "hidden" }}
    >
      <Pressable
        disabled={phonePage === undefined}
        onPress={() => phonePage !== undefined && open(phonePage)}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderColor: ink.rule,
        }}
      >
        <Text style={head}>
          {page === null ? "Settings" : crumbsFor({ kind: "page", page }).join(" › ")}
        </Text>
      </Pressable>
      {props.lines.map((line, index) => (
        <View
          // oxlint-disable-next-line react/no-array-index-key -- A fence's lines, in order.
          key={index}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 10,
            gap: 6,
            borderTopWidth: index === 0 ? 0 : 1,
            borderColor: ink.rule,
          }}
        >
          <Line line={line} ink={ink} environmentId={chat?.environmentId ?? null} />
        </View>
      ))}
    </View>
  );
}

function Line(props: {
  readonly line: FenceLine;
  readonly ink: ChartInk;
  readonly environmentId: string | null;
}) {
  const { line, ink } = props;
  const words: TextStyle = { color: ink.color, fontFamily: ink.fontFamily, fontSize: ink.fontSize };
  if ("words" in line) return <Text style={words}>{line.words}</Text>;
  const title = titleOf(line.place);
  const binding = line.place.kind === "row" ? BINDINGS[line.place.id] : undefined;
  const ast = binding?.store === "server" ? serverSettingAst(binding.key) : null;
  const control = ast === null ? null : controlOf(ast);
  if (binding !== undefined && control !== null && props.environmentId !== null)
    return (
      <MachineRow
        title={title}
        binding={binding}
        control={control}
        suggested={line.suggested}
        environmentId={props.environmentId}
        ink={ink}
      />
    );
  const phonePage = PHONE_PAGES[line.place.page];
  return (
    <Row title={title} ink={ink}>
      {phonePage === undefined ? (
        <Text style={quiet(ink)}>On the Mac</Text>
      ) : (
        <Pressable accessibilityRole="link" onPress={() => open(phonePage)} hitSlop={8}>
          <Text style={{ ...quiet(ink), color: ink.strong }}>Open</Text>
        </Pressable>
      )}
    </Row>
  );
}

const quiet = (ink: ChartInk): TextStyle => ({
  color: ink.muted,
  fontFamily: ink.fontFamily,
  fontSize: ink.fontSize * 0.85,
});

function Row(props: {
  readonly title: string;
  readonly ink: ChartInk;
  readonly children: ReactNode;
}) {
  const { ink } = props;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Text
        style={{ flex: 1, color: ink.strong, fontFamily: ink.fontFamily, fontSize: ink.fontSize }}
      >
        {props.title}
      </Text>
      {props.children}
    </View>
  );
}

function MachineRow(props: {
  readonly title: string;
  readonly binding: Binding;
  readonly control: Control;
  readonly suggested: string | undefined;
  readonly environmentId: string;
  readonly ink: ChartInk;
}) {
  const { control, ink, title } = props;
  const setting = useMachineSetting(props.environmentId, props.binding.key);
  // What the row was before this card changed it: Undo puts it back.
  const [before, setBefore] = useState<{ readonly value: Value } | null>(null);
  if (setting === null)
    return (
      <Row title={title} ink={ink}>
        <Text style={quiet(ink)}>Not connected</Text>
      </Row>
    );
  const value = (setting.value ?? null) as Value;
  const locked = setting.locked !== null;
  const change = (next: Value) => {
    if (next === value || locked) return;
    setBefore((held) => held ?? { value });
    setting.set(next);
  };
  const status = rowStatus(control, props.binding, value, props.suggested, before !== null);
  const action = (label: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" disabled={locked} onPress={onPress} hitSlop={8}>
      <Text style={{ ...quiet(ink), color: ink.strong, fontFamily: ink.strongFamily }}>
        {label}
      </Text>
    </Pressable>
  );
  return (
    <>
      <Row title={title} ink={ink}>
        {control.kind === "switch" ? (
          <ThemedSwitch
            accessibilityLabel={title}
            disabled={locked}
            value={value === true}
            onValueChange={(on) => change(on)}
          />
        ) : null}
      </Row>
      {control.kind === "choice" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {control.options.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: option === value, disabled: locked }}
              disabled={locked}
              onPress={() => change(option)}
              style={{
                borderWidth: 1,
                borderColor: option === value ? ink.strong : ink.rule,
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Text style={{ ...quiet(ink), color: option === value ? ink.strong : ink.muted }}>
                {optionLabel(option)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {setting.locked !== null ? (
        <Text style={quiet(ink)}>{setting.locked}</Text>
      ) : status?.kind === "changed" ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Text style={quiet(ink)}>Changed here.</Text>
          {action("Undo", () => {
            if (before !== null) setting.set(before.value);
            setBefore(null);
          })}
        </View>
      ) : status?.kind === "suggested" ? (
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Text style={quiet(ink)}>
            Suggested: {status.from} → <Text style={{ color: ink.strong }}>{status.to}</Text>
          </Text>
          {action("Apply", () => change(status.want))}
        </View>
      ) : status?.kind === "already" ? (
        <Text style={quiet(ink)}>{status.words}</Text>
      ) : status?.kind === "yours" ? (
        <Text style={quiet(ink)}>{YOURS}</Text>
      ) : null}
    </>
  );
}
