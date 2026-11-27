/**
 * A message to Aski that starts, makes or deletes something becomes a plan as it is sent
 * (stemcells/tasks/aski-orchestrator.md, decisions 1 and 2). The message still goes to Aski's
 * chat at once, as written; the server is told a plan is coming, so that chat's turn waits for
 * it and Aski starts nothing itself. Mounted with every composer's editor; only Aski's
 * (`PlanRoom`) reads anything. Talk never comes here: the gate is code, and it is cheap.
 */
import type { TiptapEditorHTMLElement } from "@tiptap/core";
import { use, useEffect } from "react";

import { wantsCompiler } from "../../../../../../stemcells/orchestrator/gate.ts";
import type { CellRef } from "../../tabs/layout";
import { compilePlan, expectPlan, promptOf, usePlanWorld } from "../../upstream/askiPlans";
import { randomUUID } from "../../upstream/ui";
import { type BeforeSend, WordsSendSlot } from "../../words/send";
import { useAskiPlans } from "../planning";
import { runner } from "./PlanRunner";
import { chatKeyOf, PlanRoom } from "./room";
import { readCheckAlways, readPlanCap } from "./settings";
import { beginPlan, closePlan, planRead } from "./store";

export function AskiPlans(props: { readonly anchor: string }) {
  const aski = use(PlanRoom);
  return aski === null ? null : <Planning anchor={props.anchor} aski={aski} />;
}

const editorOf = (anchor: string) => {
  const editor = document.querySelector<TiptapEditorHTMLElement>(`.${anchor}`)?.editor ?? null;
  return editor === null || editor.isDestroyed ? null : editor;
};

function Planning(props: { readonly anchor: string; readonly aski: CellRef }) {
  const { anchor, aski } = props;
  const sendSlot = use(WordsSendSlot);
  const world = usePlanWorld(aski);
  // Settings › Aski: off, Aski divides nothing, and every message is its chat's alone.
  const on = useAskiPlans();

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Register the composer's before-send hook for plans, and unregister it on each change.
  useEffect(() => {
    if (sendSlot === null || !on) return;
    const beforeSend: BeforeSend = () => {
      const editor = editorOf(anchor);
      const text = editor === null ? "" : promptOf(editor.state.doc).trim();
      if (editor === null || text.length === 0) return null;
      const now = world();
      if (now.think === null || !wantsCompiler(text, now.names)) return null;
      const { think } = now;
      const id = randomUUID();
      const chat = chatKeyOf(aski);
      const request = { id, threadId: aski.threadId, text };
      let heard = false;
      return {
        hold: false,
        // The message waits only for the server to hear a plan is coming, never for the plan.
        ready: expectPlan(request).then((ok) => {
          heard = ok;
        }),
        foreground: false,
        edit: () => {
          // Unheard, the server can't hold Aski's turn for the plan: the message is the chat's alone.
          if (!heard) return null;
          beginPlan(id, chat, Date.now());
          const plan = compilePlan({
            ...request,
            context: {
              ...now.context,
              cap: readPlanCap(),
              always: readCheckAlways(),
            },
            think,
          });
          return (sent: unknown) => {
            void Promise.resolve(sent)
              .catch(() => undefined)
              .then(async () => {
                // The words still in the composer: nothing went, so nothing starts.
                const still = editorOf(anchor);
                if (still !== null && promptOf(still.state.doc).trim() === text) {
                  closePlan(id);
                  return;
                }
                planRead(id, await plan);
              });
          };
        },
      };
    };
    return sendSlot("plan", beforeSend);
  });

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Listen for Enter on an empty composer while a plan waits, and stop listening on unmount.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.shiftKey || event.metaKey || event.ctrlKey) return;
      if (event.altKey || event.isComposing) return;
      const editor = editorOf(anchor);
      if (editor === null || !(event.target instanceof Node)) return;
      if (!editor.view.dom.contains(event.target)) return;
      if (promptOf(editor.state.doc).trim().length > 0) return;
      const waiting = runner.waitingIn(chatKeyOf(aski));
      if (waiting === null) return;
      // Enter on an empty composer says yes to the Cells that wait; a deletion never hears it.
      event.preventDefault();
      event.stopPropagation();
      runner.confirmAll(waiting);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [anchor, aski]);

  return null;
}
