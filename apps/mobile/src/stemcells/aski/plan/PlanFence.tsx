// A ```plan fence in a reply (stemcells/tasks/aski-orchestrator.md, decisions 1 and 4): the
// Cells Aski's chat proposes, read from the chat's machine by the plan's id. Every Cell waits,
// with each word it would be told showing: they are Aski's words, not the person's. A plan the
// server has forgotten says so in one dim line.

import { useEffect, useState } from "react";
import { View } from "react-native";

import { headline } from "../../../../../../stemcells/words/plans.ts";
import { useChatInView } from "../../chat/inView";
import { AppText } from "../../upstream/plans";
import { PlanPanel, usePlans } from "./PlanRows";
import { openPlan } from "./run";
import { usePlanWorld } from "./usePlanWorld";
import { PLAN_GONE, PLAN_UNREACHABLE } from "./view";

export function PlanFence(props: { readonly id: string }) {
  const chat = useChatInView();
  return chat === null ? (
    <Line words={PLAN_UNREACHABLE} />
  ) : (
    <Read id={props.id} environmentId={chat.environmentId} />
  );
}

function Line(props: { readonly words: string }) {
  return <AppText className="py-1 text-sm text-foreground-muted">{props.words}</AppText>;
}

function Read(props: { readonly id: string; readonly environmentId: string }) {
  const { id, environmentId } = props;
  const entry = usePlans().get(id);
  const [unreachable, setUnreachable] = useState(false);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- The plan a fence names lives on the chat's machine: it is read from there once the fence shows.
  useEffect(() => {
    let shown = true;
    void openPlan(environmentId, id).then((found) => {
      if (shown) setUnreachable(found === "unreachable");
    });
    return () => {
      shown = false;
    };
  }, [environmentId, id]);
  if (entry === undefined)
    return <Line words={unreachable ? PLAN_UNREACHABLE : headline(0, 0, 0, true)} />;
  if (entry.state === "gone" || entry.tray === null) return <Line words={PLAN_GONE} />;
  return <Shown id={id} environmentId={environmentId} />;
}

function Shown(props: { readonly id: string; readonly environmentId: string }) {
  const entry = usePlans().get(props.id);
  const { places, models } = usePlanWorld(props.environmentId);
  if (entry === undefined) return null;
  return (
    <View className="my-1 overflow-hidden rounded-[16px] border border-border bg-card-alt">
      <PlanPanel entry={entry} places={places} models={models} open />
    </View>
  );
}
