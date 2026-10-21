/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (aski.css), outside upstream's Tailwind entry. */
// The spawn's theater: Aski's act (spawn.ts) at the rect the composer gave,
// over the page. The scene worker draws it as it draws the moments; under
// Reduce Motion each part holds its still. It fades in as the act starts and
// out once the act is through, then goes.

import { useEffect, useEffectEvent, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { timed } from "../tokens/motion.ts";
import { MomentPlayer } from "./moments/player.ts";
import { type Spawn, onSpawn, spawnEndsAt, spawnGone, spawnNow, spawnPart } from "./spawn.ts";
import "./aski.css";

export function AskiSpawn() {
  const spawn = useSyncExternalStore(onSpawn, spawnNow);
  if (spawn === null || typeof document === "undefined") return null;
  return createPortal(<SpawnTheater key={spawn.id} spawn={spawn} />, document.body);
}

function SpawnTheater(props: { spawn: Spawn }) {
  const { spawn } = props;
  const theaterRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<MomentPlayer | null>(null);

  const rect = spawn.rect;
  useEffect(() => {
    const theater = theaterRef.current;
    if (theater === null) return;
    // One canvas per act: its control goes to the worker once, for good.
    const canvas = document.createElement("canvas");
    canvas.className = "aski-moment";
    canvas.setAttribute("aria-hidden", "true");
    theater.append(canvas);
    const player = new MomentPlayer(canvas, theater);
    player.size({ width: rect.width, aski: rect.height, top: 0 });
    player.run(true);
    playerRef.current = player;
    return () => {
      player.close();
      canvas.remove();
      playerRef.current = null;
    };
  }, [rect]);

  // The pour from the start, the bud once the plan is in.
  const play = useEffectEvent((from: number) => {
    const part = spawnPart(spawn);
    if (part.startedAt === from) playerRef.current?.play(part);
  });
  const from = spawnPart(spawn).startedAt;
  useEffect(() => {
    play(from);
  }, [from]);

  const endsAt = spawnEndsAt(spawn),
    id = spawn.id;
  useEffect(() => {
    let gone: ReturnType<typeof setTimeout> | undefined;
    const ends = setTimeout(
      () => {
        playerRef.current?.stop();
        gone = setTimeout(() => spawnGone(id), timed("fade").duration);
      },
      Math.max(0, endsAt - Date.now()),
    );
    return () => {
      clearTimeout(ends);
      clearTimeout(gone);
    };
  }, [endsAt, id]);

  return (
    <div
      ref={theaterRef}
      className="aski-spawn"
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
      }}
    />
  );
}
