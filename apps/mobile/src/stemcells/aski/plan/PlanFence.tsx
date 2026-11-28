// A ```plan fence in Aski's chat (stemcells/tasks/aski-orchestrator.md, decisions 1, 4, 15), read
// from the chat's machine by the plan's id. In a reply it is what Aski proposes: every Cell waits,
// its words showing, since they are Aski's. Under the person's message it is the plan made from
// it, as it stands now. A plan the server has forgotten says so in one dim line.

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
  // Over the composer it is the tray's.
  if (entry.door === "composer") return null;
  if (entry.state === "gone" || entry.tray === null) return <Line words={PLAN_GONE} />;
  return <Shown id={id} environmentId={environmentId} />;
}

function Shown(props: { readonly id: string; readonly environmentId: string }) {
  const entry = usePlans().get(props.id);
  const { places, models } = usePlanWorld(props.environmentId);
  if (entry === undefined) return null;
  return (
    <View className="my-1 overflow-hidden rounded-[16px] border border-border bg-card-alt">
      <PlanPanel
        entry={entry}
        places={places}
        models={models}
        open={entry.tray?.plan.from === "proposed"}
      />
    </View>
  );
}
