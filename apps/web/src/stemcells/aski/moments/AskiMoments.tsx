/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (aski.css), outside upstream's Tailwind entry. */
// Aski's moments, around its figure: the theater a moment plays in, the
// line it types beside Aski, and the watch for what earns one. A moment
// earned while Aski is out of sight waits a while for the person to look.
// When it plays it asks the lively budget first, so moments stay rare and
// none plays while anything waits on the person.

import { type ReactNode, useEffect, useEffectEvent, useRef } from "react";

import { takeRare } from "../../motion/lively";
import { useMinute } from "../../rail/clock";
import type { CellRef } from "../../tabs/layout";
import { reducedMotion } from "../../tokens/motion";
import { useAskiHome } from "../../upstream/askiEyes";
import { useRunsDropped } from "../../upstream/askiMoments";
import { usePresent } from "../presence";
import words from "../strings/en.json" with { type: "json" };
import { useShown } from "../useShown";
import { MOMENT_CARDS, type MomentId } from "./cards";
import { typeLine } from "./line";
import { MomentPlayer } from "./player";
import { markPlayed, playedFor } from "./seen";
import { backAfter, clicked, nightOf } from "./triggers";
import "../../tokens/stemcells.css";
import "../aski.css";

/** How long an earned moment waits for the person to look before it lapses. */
const DUE_FOR = 10 * 60_000;
/**
 * How long Aski must have been in sight before a moment plays, and the
 * least it waits after being earned: a glance passing over the page, or a
 * stage that is put up and taken down again, spends nothing.
 */
const LOOK = 1_000;
const NOTICE = 400;

/** A moment earned: which, what it says, when, and what it plays once for, if it does. */
interface Earned {
  readonly id: MomentId;
  readonly line: string;
  readonly at: number;
  readonly once?: string | undefined;
}

/** Ends the moment playing, if one is: its line cleared and the figure back. */
function stopPlaying(playing: { current: (() => void) | null }): void {
  playing.current?.();
  playing.current = null;
}

/**
 * Aski's figure, `children`, in the theater its moments play in. `aski` is
 * Aski's chat, as the figure takes it.
 */
export function AskiMoments(props: { aski: CellRef | null; children: ReactNode }) {
  const theaterRef = useRef<HTMLDivElement>(null);
  const typedRef = useRef<HTMLSpanElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const saidRef = useRef<HTMLSpanElement>(null);
  const playerRef = useRef<MomentPlayer | null>(null);
  const earnedRef = useRef<Earned | null>(null);
  const playingRef = useRef<(() => void) | null>(null);
  const shownSince = useRef<number | null>(null);
  const due = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const minute = useMinute();
  const home = useAskiHome(props.aski, new Date(minute).toISOString());
  const present = usePresent();
  const dropped = useRunsDropped();
  const shown = useShown(theaterRef);
  const working = home.chats.filter((standing) => standing === "working").length;

  /** Plays the moment earned, if the person can see it and the budget allows. */
  const play = useEffectEvent(() => {
    const earned = earnedRef.current;
    const player = playerRef.current;
    if (earned === null || player === null || playingRef.current !== null) return;
    if (shownSince.current === null) return;
    earnedRef.current = null;
    const now = Date.now();
    if (now - earned.at > DUE_FOR) return;
    if (earned.once !== undefined && playedFor(earned.id, earned.once)) return;
    if (!takeRare(earned.id, now, home.waits)) return;
    if (!player.play({ id: earned.id, startedAt: now })) return;
    if (earned.once !== undefined) markPlayed(earned.id, earned.once);
    const card = MOMENT_CARDS[earned.id]();
    const said = saidRef.current;
    // Under Reduce Motion the still tells it all at once, the line with it.
    const still = reducedMotion();
    const clear =
      typedRef.current && cursorRef.current
        ? typeLine(
            typedRef.current,
            cursorRef.current,
            earned.line,
            still ? now : now + (card.beats.say ?? 0) * 1000,
            still,
          )
        : () => {};
    if (said) said.textContent = earned.line;
    const ending = setTimeout(() => stopPlaying(playingRef), card.end * 1000);
    playingRef.current = () => {
      clearTimeout(ending);
      clear();
      if (said) said.textContent = "";
      player.stop();
    };
  });

  /** Plays the moment earned once Aski has been in sight a while, if it is. */
  const schedule = useEffectEvent(() => {
    clearTimeout(due.current);
    if (earnedRef.current === null || shownSince.current === null) return;
    const wait = Math.max(NOTICE, shownSince.current + LOOK - Date.now());
    due.current = setTimeout(() => play(), wait);
  });

  /** A moment is earned: it plays when the person has seen Aski a moment, now or once they look. */
  const earn = useEffectEvent((earned: Earned) => {
    if (playingRef.current !== null) return;
    earnedRef.current = earned;
    schedule();
  });

  const clicks = useRef<number[]>([]);
  const onClick = useEffectEvent((event: MouseEvent) => {
    if (!(event.target instanceof Element) || event.target.closest(".aski-figure") === null) return;
    const now = Date.now();
    const next = clicked(clicks.current, now);
    clicks.current = next.clicks;
    if (next.seven) earn({ id: "bits", line: words["moment.bits"], at: now });
  });

  useEffect(() => {
    const theater = theaterRef.current;
    if (theater === null) return;
    // The canvas is made here, one per mount: its control goes to the worker once, for good.
    const canvas = document.createElement("canvas");
    canvas.className = "aski-moment";
    canvas.setAttribute("aria-hidden", "true");
    theater.append(canvas);
    const player = new MomentPlayer(canvas, theater);
    playerRef.current = player;
    const measure = (): void => {
      const figure = theater.querySelector(".aski-figure");
      if (!(figure instanceof HTMLElement) || theater.clientWidth === 0) return;
      player.size({ width: theater.clientWidth, aski: figure.offsetHeight, top: figure.offsetTop });
    };
    // oxlint-disable-next-line t3code/no-raw-resize-observer -- The size places the moment's canvas by style, never through React state.
    const sized = new ResizeObserver(measure);
    sized.observe(theater);
    measure();
    const click = (event: MouseEvent): void => onClick(event);
    theater.addEventListener("click", click);
    return () => {
      theater.removeEventListener("click", click);
      clearTimeout(due.current);
      sized.disconnect();
      stopPlaying(playingRef);
      player.close();
      canvas.remove();
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    playerRef.current?.run(shown);
    shownSince.current = shown ? Date.now() : null;
    schedule();
  }, [shown]);

  // Back: the server answers again after a silence in which no run was lost.
  const silentSince = useRef<number | null>(null);
  const droppedNow = useEffectEvent(() => dropped);
  useEffect(() => {
    const now = Date.now();
    if (!home.answers) {
      silentSince.current ??= now;
      return;
    }
    const since = silentSince.current;
    silentSince.current = null;
    if (since !== null && backAfter(since, now, droppedNow()))
      earn({ id: "back", line: words["moment.back"], at: now });
  }, [home.answers]);

  // The night shift: the first look at Aski tonight while Cells work.
  useEffect(() => {
    if (!shown || !present || working === 0) return;
    const night = nightOf(new Date(minute));
    if (night === null || playedFor("night", night)) return;
    earn({ id: "night", line: words["moment.night"], at: Date.now(), once: night });
  }, [shown, present, working, minute]);

  return (
    <div ref={theaterRef} className="aski-moments">
      {props.children}
      <p className="aski-moment-line" role="status">
        <span ref={saidRef} className="sr-only" />
        <span ref={typedRef} aria-hidden="true" />
        <span ref={cursorRef} aria-hidden="true" className="aski-moment-cursor" hidden />
      </p>
    </div>
  );
}
