/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (peers.css), outside upstream's Tailwind entry. */
import { use, useState } from "react";

import { threadIdOf, TimelineRowCtx, usePeerShell } from "../upstream/peers";
import { CellDoor } from "./CellDoor";
import { peerNameOf } from "./names";
import { filesOf } from "./notice";

import "./peers.css";

// A past notice that this Cell and another stepped on each other
// (stemcells/tasks/peers.md, decision 3): the other Cell a door to its
// chat, the files its first line names, and the rest, what the Cell was
// told to do, under "More".

export function CollisionRow(props: {
  readonly message: { readonly id: string; readonly text: string };
  readonly collision: { readonly kind: "file" | "checkout"; readonly other: string };
}) {
  const { message, collision } = props;
  const ctx = use(TimelineRowCtx);
  const shell = usePeerShell(ctx.activeThreadEnvironmentId, collision.other);
  const name = peerNameOf(collision.other, shell);
  const files = filesOf(message.text);
  const rest = message.text.split("\n").slice(1).join("\n").trim();
  const [open, setOpen] = useState(false);

  return (
    <div className="sc-collision text-xs" data-stemcells-peer="collision">
      <div className="sc-collision-line">
        <span className="sc-collision-mark" aria-hidden>
          ⚠
        </span>
        <span className="flex-none">
          {collision.kind === "file" ? "Same file as" : "Same checkout as"}
        </span>
        <CellDoor
          name={name}
          title={shell?.title}
          onOpen={() => ctx.onOpenThread(threadIdOf(collision.other))}
        />
        {files === "" ? null : (
          <span className="sc-collision-files" data-thread-find-text="true">
            {files}
          </span>
        )}
        {rest === "" ? null : (
          <button
            type="button"
            className="sc-collision-more"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            More
          </button>
        )}
      </div>
      {open ? <p className="sc-collision-rest">{rest}</p> : null}
    </div>
  );
}
