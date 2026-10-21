/* oxlint-disable shadcn/no-unknown-classes -- Stemcells' classes live in its own stylesheet (aski.css), outside upstream's Tailwind entry. */
// Aski's moments, around its figure: the theater a moment plays in, and
// the line it types beside Aski. Most are earned by the watch
// (`AskiMomentWatch.tsx`); the seven bits and the night shift are earned
// here, by looking at Aski. A moment earned while Aski is out of sight
// waits a while for the person to look. When it plays it asks the lively
// budget first, so moments stay rare and none plays while anything waits
// on the person.

import { type ReactNode, useEffect, useEffectEvent, useRef } from "react";

import { takeRare } from "../../motion/lively";
import { useMinute } from "../../rail/clock";
import type { CellRef } from "../../tabs/layout";
import { reducedMotion } from "../../tokens/motion";
import { useAskiHome } from "../../upstream/askiEyes";
import { useMomentChats } from "../../upstream/askiMoments";
import { BLOCK_WIDTH } from "../eye";
import { usePresent } from "../presence";
import words from "../strings/en.json" with { type: "json" };
import { useShown } from "../useShown";
import { momentCard } from "./cards";
import { earn, earnedMoment, onEarned, takeEarned } from "./earned";
import { typeLine } from "./line";
import { type LinePlace } from "./news";
import { MomentPlayer } from "./player";
import { markPlayed, playedFor } from "./seen";
import { clicked, nightOf } from "./triggers";
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
  const lineRef = useRef<HTMLParagraphElement>(null);
  const playerRef = useRef<MomentPlayer | null>(null);
  const playingRef = useRef<(() => void) | null>(null);
  const shownSince = useRef<number | null>(null);
  const due = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const minute = useMinute();
  const home = useAskiHome(props.aski, new Date(minute).toISOString());
  const chats = useMomentChats(props.aski, new Date(minute).toISOString());
  const present = usePresent();
  const shown = useShown(theaterRef);
  const working = chats.filter((chat) => chat.standing === "working").length;

  /**
   * Where `line` will stand once typed, in the moment's cells: where its
   * cursor stands as it starts, and after its last character.
   */
  const linePlace = (line: string): LinePlace | undefined => {
    const p = lineRef.current,
      typed = typedRef.current,
      theater = theaterRef.current,
      player = playerRef.current;
    if (!p || !typed || !theater || !player || line.length === 0) return undefined;
    typed.textContent = line;
    const text = typed.firstChild;
    const range = document.createRange();
    const box = theater.getBoundingClientRect();
    const cursor = (Number.parseFloat(getComputedStyle(p).fontSize) * BLOCK_WIDTH) / 2;
    const at = (n: number, side: "left" | "right"): readonly [number, number] | undefined => {
      if (text === null) return undefined;
      range.setStart(text, n);
      range.setEnd(text, n + 1);
      const rect = [...range.getClientRects()].at(-1);
      if (rect === undefined) return undefined;
      // The cursor's middle: half a block past the edge it stands at.
      return player.cellAt(rect[side] - box.left + cursor, rect.top + rect.height / 2 - box.top);
    };
    const from = at(0, "left"),
      to = at(line.length - 1, "right");
    typed.textContent = "";
    return from && to ? { from, to } : undefined;
  };

  /** Plays the moment earned, if the person can see it and the budget allows. */
  const play = useEffectEvent(() => {
    const player = playerRef.current;
    if (player === null || playingRef.current !== null || shownSince.current === null) return;
    const earned = takeEarned();
    if (earned === null) return;
    const now = Date.now();
    if (now - earned.at > DUE_FOR) return;
    if (earned.once !== undefined && playedFor(earned.id, earned.once)) return;
    if (!takeRare(earned.id, now, home.waits)) return;
    const args = { ...earned.args, line: linePlace(earned.line) };
    const card = momentCard(earned.id, args);
    if (card === undefined || !player.play({ id: earned.id, startedAt: now, args })) return;
    if (earned.once !== undefined) markPlayed(earned.id, earned.once);
    const said = saidRef.current;
    // Under Reduce Motion the still tells it all at once, the line with it.
    const still = reducedMotion();
    // A moment with no line says it all in its picture.
    const clear =
      earned.line !== "" && typedRef.current && cursorRef.current
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
    if (earnedMoment() === null || shownSince.current === null) return;
    const wait = Math.max(NOTICE, shownSince.current + LOOK - Date.now());
    due.current = setTimeout(() => play(), wait);
  });

  /** A moment is earned: it plays when the person has seen Aski a moment, now or once they look; one earned while another plays is dropped. */
  const heard = useEffectEvent(() => {
    if (playingRef.current === null) schedule();
    else takeEarned();
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
    const deaf = onEarned(() => heard());
    return () => {
      deaf();
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

  // The night shift: the first look at Aski tonight while Cells work.
  useEffect(() => {
    if (!shown || !present || working === 0) return;
    const night = nightOf(new Date(minute));
    // A moment already waiting to play goes first; the night is earned again next minute.
    if (night === null || playedFor("night", night) || earnedMoment() !== null) return;
    earn({ id: "night", line: words["moment.night"], at: Date.now(), once: night });
  }, [shown, present, working, minute]);

  return (
    <div ref={theaterRef} className="aski-moments">
      {props.children}
      <p ref={lineRef} className="aski-moment-line" role="status">
        <span ref={saidRef} className="sr-only" />
        <span ref={typedRef} aria-hidden="true" />
        <span ref={cursorRef} aria-hidden="true" className="aski-moment-cursor" hidden />
      </p>
    </div>
  );
}
