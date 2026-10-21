/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (aski.css), outside upstream's Tailwind entry. */
// The spawn's theater: Aski's act (spawn.ts) at the rect the composer gave,
// over the page. The scene worker draws it as it draws the moments, with the
// motion tokens' times read here. It fades in as the act starts and out once
// the act is through, then goes. Under Reduce Motion Aski doesn't appear.

import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { reducedMotion, timed, timing } from "../tokens/motion.ts";
import { MomentPlayer } from "./moments/player.ts";
import {
  type Spawn,
  type SpawnTimes,
  onSpawn,
  spawnEndsAt,
  spawnGone,
  spawnNow,
  spawnPart,
} from "./spawn.ts";
import "./aski.css";

/** The act's times from the motion tokens, in seconds (stemcells/docs/interaction.md, The spawn). */
function spawnTimes(): SpawnTimes {
  return {
    lookIn: (timing("lettersSpan") + timed("travel").duration) / 1000,
    turn: timing("orbitTurn") / 1000,
    stagger: timing("spawnStagger") / 1000,
    travel: timed("travel").duration / 1000,
    flick: timed("flick").duration / 1000,
  };
}

export function AskiSpawn() {
  const spawn = useSyncExternalStore(onSpawn, spawnNow);
  if (spawn === null || typeof document === "undefined" || reducedMotion()) return null;
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

  // Aski waiting from the start, throwing once the plan is in.
  const [times] = useState(spawnTimes);
  const play = useEffectEvent((from: number) => {
    const part = spawnPart(spawn, times);
    if (part.startedAt === from) playerRef.current?.play(part);
  });
  const from = spawn.plannedAt ?? spawn.startedAt;
  useEffect(() => {
    play(from);
  }, [from]);

  const endsAt = spawnEndsAt(spawn, times),
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
